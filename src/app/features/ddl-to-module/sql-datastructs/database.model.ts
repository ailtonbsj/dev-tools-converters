export type Dialect = 'postgresql' | 'oracle';

export type JavaType = 'Integer' | 'Long' | 'String' | 'Double' | 'Float' | 'BigDecimal' | 'LocalDate' | 'LocalDateTime' | 'Timestamp' | 'Boolean';

export interface DatabaseTable {
  schema: string
  table: string
  columns: DatabaseTableColunm[];
}

export interface DatabaseTableColunm {
  isPrimary: boolean
  isUnique: boolean
  isNullable: boolean
  autoincrement: boolean
  column: string
  type: string
  len: number
  scale: number
  references: string
  allowValues: string[]
  comment: string
  label: string
  lenChars: number
  uiComponent: string
  javaType: JavaType
  javaFieldName: string
}
