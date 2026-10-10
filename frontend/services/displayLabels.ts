const acronyms = new Set(['id', 'ids', 'ai', 'api', 'csv', 'json', 'jsonl', 'xlsx', 'pii', 'sha', 'ks', 'tvd']);

/** Presentation only: identifiers in specs, lookups and exports remain untouched. */
export function displayLabel(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_+/g, ' ').trim()
    .split(/\s+/).map(word => acronyms.has(word.toLowerCase()) ? word.toUpperCase() :
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}

const types: Record<string, string> = {
  integer: 'Integer', float: 'Decimal', string: 'Text', boolean: 'Boolean', datetime: 'Date & Time',
  generic_text: 'General Text', numeric: 'Number', categorical: 'Category', id: 'ID',
  person_name: 'Person Name', email: 'Email', phone: 'Phone Number', money: 'Currency',
};
export function displayType(value: string): string { return types[value] || displayLabel(value); }

export function displayMessage(message: string): string {
  const knownMessage = message.replace(/^Generation error:\s*/i, '');
  if (knownMessage === 'Failed to fetch') return 'Could not connect to the server. Please try again.';
  if (/^Derived value violates upper bound\.?$/i.test(knownMessage)) {
    return 'A calculated value exceeds its allowed maximum. Review the schema limits and generate again.';
  }
  return message;
}
