"""Document download endpoints: JSON, CSV, PDF (single), ZIP (all, capped).

Serves invoice and bank-statement documents generated from relational artifacts.
PDF uses reportlab (pure Python, no C extension beyond Pillow which is optional).
"""
import io
import json
import zipfile
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.api.jobs import artifacts  # reuse the same store

router = APIRouter(prefix='/api/v1/documents')

_ZIP_CAP = 100   # max documents per ZIP to protect free-tier memory


def _get_doc_table(artifact_id: str, doc_key: str) -> list[dict]:
    """Download the manifest artifact and return the rows for doc_key."""
    try:
        art = artifacts.get(artifact_id)
    except KeyError:
        raise HTTPException(404, 'Artifact not found or expired.') from None

    if art.format == 'json':
        # It's a manifest — resolve the doc table artifact
        with artifacts.open(artifact_id) as f:
            manifest = json.loads(f.read())
        tables = manifest.get('tables', {})
        if doc_key not in tables:
            raise HTTPException(404, f"Document key '{doc_key}' not in manifest.")
        doc_artifact_id = tables[doc_key]
        try:
            doc_art = artifacts.get(doc_artifact_id)
        except KeyError:
            raise HTTPException(404, 'Document artifact not found or expired.') from None
        with artifacts.open(doc_artifact_id) as f:
            rows = [json.loads(line) for line in f if line.strip()]
    elif art.format == 'jsonl':
        # Direct JSONL document artifact
        with artifacts.open(artifact_id) as f:
            rows = [json.loads(line) for line in f if line.strip()]
    else:
        raise HTTPException(400, 'Artifact is not a document artifact.')
    return rows


# ---------------------------------------------------------------------------
# JSON download
# ---------------------------------------------------------------------------

@router.get('/{artifact_id}/{doc_key}/json')
def download_json(artifact_id: str, doc_key: str):
    rows = _get_doc_table(artifact_id, doc_key)
    content = json.dumps(rows, ensure_ascii=False, indent=2).encode('utf-8')
    filename = f'{doc_key}.json'
    return StreamingResponse(
        io.BytesIO(content),
        media_type='application/json',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# CSV download (flattens top-level scalar fields; skips nested lines/transactions)
# ---------------------------------------------------------------------------

@router.get('/{artifact_id}/{doc_key}/csv')
def download_csv(artifact_id: str, doc_key: str):
    import csv
    rows = _get_doc_table(artifact_id, doc_key)

    def _flatten(row: dict) -> dict:
        flat = {}
        for k, v in row.items():
            if isinstance(v, (list, dict)):
                flat[k] = json.dumps(v, ensure_ascii=False)
            else:
                flat[k] = v
        return flat

    flat_rows = [_flatten(r) for r in rows]
    buf = io.StringIO()
    if flat_rows:
        writer = csv.DictWriter(buf, fieldnames=list(flat_rows[0].keys()))
        writer.writeheader()
        writer.writerows(flat_rows)
    content = buf.getvalue().encode('utf-8')
    filename = f'{doc_key}.csv'
    return StreamingResponse(
        io.BytesIO(content),
        media_type='text/csv',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# PDF — single document
# ---------------------------------------------------------------------------

def _build_invoice_pdf(doc: dict) -> bytes:
    """Render one invoice dict to a PDF byte string using reportlab."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib import colors

    buf = io.BytesIO()
    doc_pdf = SimpleDocTemplate(buf, pagesize=A4,
                                 leftMargin=2*cm, rightMargin=2*cm,
                                 topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    story = []

    # Header
    story.append(Paragraph(f"<b>INVOICE #{doc.get('entity_id', '?')}</b>", styles['Title']))
    story.append(Spacer(1, 0.3*cm))

    entity = doc.get('entity', {})
    billed_to = ', '.join(str(v) for k, v in entity.items() if k != 'id' and v)
    if billed_to:
        story.append(Paragraph(f"<b>Billed to:</b> {billed_to}", styles['Normal']))
    story.append(Spacer(1, 0.5*cm))

    # Line items
    lines = doc.get('lines', [])
    table_data = [['Description', 'Qty', 'Unit Price', 'Line Total']]
    for line in lines:
        src = line.get('source', {})
        qty = src.get('quantity', src.get('qty', 1))
        price = src.get('unit_price', src.get('price', 0))
        product = src.get('product_id', src.get('name', '—'))
        table_data.append([
            str(product),
            str(qty),
            f"{price:,.2f}" if isinstance(price, (int, float)) else str(price),
            str(line.get('line_total', '—')),
        ])

    if table_data:
        t = Table(table_data, colWidths=[8*cm, 2*cm, 4*cm, 3*cm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a3a2a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#cccccc')),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.5*cm))

    # Summary
    summary_data = [
        ['Subtotal', str(doc.get('subtotal', '—'))],
        ['Tax', str(doc.get('tax', '—'))],
        ['Discount', str(doc.get('discount', '—'))],
        ['Total', str(doc.get('total', '—'))],
    ]
    st = Table(summary_data, colWidths=[13*cm, 4*cm])
    st.setStyle(TableStyle([
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('LINEABOVE', (0, -1), (-1, -1), 1, colors.HexColor('#1a3a2a')),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
    ]))
    story.append(st)

    doc_pdf.build(story)
    return buf.getvalue()


def _build_statement_pdf(doc: dict) -> bytes:
    """Render one bank statement to a PDF byte string."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib import colors

    buf = io.BytesIO()
    doc_pdf = SimpleDocTemplate(buf, pagesize=A4,
                                 leftMargin=2*cm, rightMargin=2*cm,
                                 topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph(f"<b>Bank Statement — Account #{doc.get('entity_id', '?')}</b>", styles['Title']))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        f"Opening balance: <b>{doc.get('opening_balance', '—')}</b>   "
        f"Closing balance: <b>{doc.get('closing_balance', '—')}</b>",
        styles['Normal']
    ))
    story.append(Spacer(1, 0.5*cm))

    txns = doc.get('transactions', [])
    table_data = [['Date', 'Credit', 'Debit', 'Balance']]
    for txn in txns:
        table_data.append([
            str(txn.get('date', '—'))[:10],
            str(txn.get('credit', '—')),
            str(txn.get('debit', '—')),
            str(txn.get('balance', '—')),
        ])

    if table_data:
        t = Table(table_data, colWidths=[5*cm, 4*cm, 4*cm, 4*cm])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a3a2a')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f5f5f5')]),
            ('GRID', (0, 0), (-1, -1), 0.3, colors.HexColor('#cccccc')),
            ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ]))
        story.append(t)

    doc_pdf.build(story)
    return buf.getvalue()


@router.get('/{artifact_id}/{doc_key}/pdf/{index}')
def download_pdf(artifact_id: str, doc_key: str, index: int):
    rows = _get_doc_table(artifact_id, doc_key)
    if index < 0 or index >= len(rows):
        raise HTTPException(404, f'Document index {index} out of range (0–{len(rows)-1}).')
    doc = rows[index]
    try:
        if 'invoice' in doc_key:
            pdf_bytes = _build_invoice_pdf(doc)
        else:
            pdf_bytes = _build_statement_pdf(doc)
    except ImportError:
        raise HTTPException(503, 'PDF generation requires reportlab. Install it with: pip install reportlab') from None
    except Exception as exc:
        raise HTTPException(500, f'PDF generation failed: {exc}') from None

    filename = f'{doc_key}_{index}.pdf'
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type='application/pdf',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# ZIP — all documents (capped)
# ---------------------------------------------------------------------------

@router.get('/{artifact_id}/{doc_key}/zip')
def download_zip(artifact_id: str, doc_key: str, format: str = 'json'):
    rows = _get_doc_table(artifact_id, doc_key)
    rows = rows[:_ZIP_CAP]  # hard cap to protect memory

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for i, doc in enumerate(rows):
            if format == 'pdf':
                try:
                    if 'invoice' in doc_key:
                        content = _build_invoice_pdf(doc)
                    else:
                        content = _build_statement_pdf(doc)
                    zf.writestr(f'{doc_key}_{i}.pdf', content)
                except Exception:
                    zf.writestr(f'{doc_key}_{i}.json',
                                json.dumps(doc, ensure_ascii=False, indent=2))
            else:
                zf.writestr(f'{doc_key}_{i}.json',
                            json.dumps(doc, ensure_ascii=False, indent=2))

    buf.seek(0)
    filename = f'{doc_key}_all.zip'
    return StreamingResponse(
        buf,
        media_type='application/zip',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )
