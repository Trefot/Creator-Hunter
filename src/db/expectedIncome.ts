import { getDb, newId } from './database';
export interface ExpectedIncome {
    id: string;
    description: string;
    amount_minor: number;
    currency: string;
    expected_on: string;
    received: boolean;
}
export async function expectedIncome() { const rows = await (await getDb()).select<{
    id: string;
    content: string;
}[]>("SELECT id,content FROM alert_cursor WHERE id LIKE 'income-due:%'"); return rows.flatMap(r => { try {
    return [{ ...JSON.parse(r.content), id: r.id } as ExpectedIncome];
}
catch {
    return [];
} }); }
export async function addExpectedIncome(value: Omit<ExpectedIncome, 'id' | 'received'>) { await (await getDb()).execute('INSERT INTO alert_cursor(id,content) VALUES($1,$2)', ['income-due:' + newId(), JSON.stringify({ ...value, received: false })]); }
