ALTER TABLE sales_clients ADD COLUMN IF NOT EXISTS cpf text;
ALTER TABLE sales_clients ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE sales_clients ADD COLUMN IF NOT EXISTS source_custom text;
