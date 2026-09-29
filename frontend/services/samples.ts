export interface SampleDatasetInfo {
  id: string;
  name: string;
  badge: string;
  tagline: string;
  description: string;
  rowCount: number;
  columnsCount: number;
  primaryTarget: string;
  targetTask: 'classification' | 'regression';
  generateCsv: () => string;
}

export const SAMPLE_DATASETS: SampleDatasetInfo[] = [
  {
    id: 'customer_churn',
    name: 'Telco Customer Churn',
    badge: 'TSTR Classification',
    tagline: 'Predict customer churn probability from subscription profile',
    description:
      'Realistic customer dataset containing tenure, monthly charges, contract types, and retention status.',
    rowCount: 200,
    columnsCount: 9,
    primaryTarget: 'churn',
    targetTask: 'classification',
    generateCsv: () => {
      const header =
        'customer_id,gender,senior_citizen,tenure_months,monthly_charges,total_charges,contract_type,payment_method,churn\n';
      const contracts = ['Month-to-month', 'One year', 'Two year'];
      const payments = [
        'Electronic check',
        'Mailed check',
        'Bank transfer',
        'Credit card',
      ];
      const genders = ['Female', 'Male'];
      const rows: string[] = [];

      for (let i = 1; i <= 200; i++) {
        const id = 1000 + i;
        const gender = genders[i % 2];
        const senior = i % 7 === 0 ? 1 : 0;
        const tenure = Math.max(1, (i * 3) % 72);
        const monthly = parseFloat((35 + (i * 4.7) % 80).toFixed(2));
        const total = parseFloat((monthly * tenure * 0.95).toFixed(2));
        const contract = contracts[i % 3];
        const payment = payments[i % 4];
        // High monthly and low tenure correlate with churn
        const churn =
          (contract === 'Month-to-month' && monthly > 70) || tenure < 6
            ? 'Yes'
            : 'No';
        rows.push(
          `${id},${gender},${senior},${tenure},${monthly},${total},${contract},${payment},${churn}`
        );
      }
      return header + rows.join('\n');
    },
  },
  {
    id: 'loan_portfolio',
    name: 'Retail Loan Portfolio',
    badge: 'TSTR Regression',
    tagline: 'Assess credit risk score and interest rate dynamics',
    description:
      'Applicant records featuring credit score, debt-to-income, loan amount, and predicted risk rate.',
    rowCount: 220,
    columnsCount: 8,
    primaryTarget: 'interest_rate',
    targetTask: 'regression',
    generateCsv: () => {
      const header =
        'applicant_id,age,annual_income,credit_score,loan_amount,debt_to_income,term_months,interest_rate\n';
      const rows: string[] = [];

      for (let i = 1; i <= 220; i++) {
        const id = 20000 + i;
        const age = 22 + (i % 45);
        const income = 32000 + ((i * 1250) % 110000);
        const credit = 560 + ((i * 17) % 290);
        const loan = 5000 + ((i * 2100) % 45000);
        const dti = parseFloat((0.15 + (i * 0.013) % 0.35).toFixed(3));
        const term = i % 2 === 0 ? 36 : 60;
        // Interest rate strongly anti-correlated with credit score
        const rate = parseFloat(
          (4.5 + (850 - credit) * 0.035 + dti * 8).toFixed(2)
        );
        rows.push(
          `${id},${age},${income},${credit},${loan},${dti},${term},${rate}`
        );
      }
      return header + rows.join('\n');
    },
  },
  {
    id: 'ecommerce_sales',
    name: 'E-Commerce Transactions',
    badge: 'Multi-Attribute',
    tagline: 'Retail orders with currency, categorical tags, and dates',
    description:
      'Order details with merchant categories, quantities, unit prices, shipping logistics, and order state.',
    rowCount: 180,
    columnsCount: 8,
    primaryTarget: 'order_status',
    targetTask: 'classification',
    generateCsv: () => {
      const header =
        'order_id,customer_name,email,region,category,quantity,unit_price,order_status\n';
      const regions = ['North America', 'Europe', 'Asia-Pacific', 'Latin America'];
      const categories = [
        'Electronics',
        'Home Goods',
        'Apparel',
        'Office Supplies',
      ];
      const statuses = ['Delivered', 'Processing', 'Cancelled'];
      const names = [
        'Alice Smith',
        'Bob Jones',
        'Claire Patel',
        'David Chen',
        'Elena Rossi',
        'Faisal Khan',
        'Grace Kim',
        'Hassan Ali',
      ];
      const rows: string[] = [];

      for (let i = 1; i <= 180; i++) {
        const id = 5000 + i;
        const name = names[i % names.length];
        const email = `${name.toLowerCase().replace(' ', '.')}@example.com`;
        const region = regions[i % regions.length];
        const cat = categories[i % categories.length];
        const qty = 1 + (i % 8);
        const price = parseFloat((12.5 + (i * 3.3) % 190).toFixed(2));
        const status = statuses[i % 9 === 0 ? 2 : i % 3 === 0 ? 1 : 0];
        rows.push(
          `${id},${name},${email},${region},${cat},${qty},${price},${status}`
        );
      }
      return header + rows.join('\n');
    },
  },
];

export function getSampleFile(sample: SampleDatasetInfo): File {
  const csvContent = sample.generateCsv();
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  return new File([blob], `${sample.id}.csv`, { type: 'text/csv' });
}
