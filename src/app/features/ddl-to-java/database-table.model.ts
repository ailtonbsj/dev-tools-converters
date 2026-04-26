export interface DatabaseTable {
  schema: string
  table: string
  columns: TableColunm[];
}

export interface TableColunm {
  isNullable: boolean
  isUnique: boolean
  isPrimary: boolean
  autoincrement: boolean
  column: string
  type: string
  len: number
  scale: number
  references: string
  allowValues: string[]
}
