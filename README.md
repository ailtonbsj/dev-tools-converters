# Dev Tools

## PROMPT: DBeaver metadados para DTO Java

This is CSV metadata from a query in DBeaver. The columns are:
`Name Label  Number  Type  CatalogName Schemaname TableName  MaxLength Precision  Scale JDBCType  isNull  Auto  Description`

```
NOME	NOME	0	VARCHAR2				120	120	0	VARCHAR			
INEP	INEP	1	VARCHAR2				15	15	0	VARCHAR			
TIPO	TIPO	2	VARCHAR2				2	2	0	VARCHAR					
```

Create a DTO in Java with all these properties, less ROWNUM_.
Use lombok anotations @Getter @Setter @NoArgsConstructor, etc.
Implements Serializable.
Name class as MinhaConsultaDTO.

## PROMPT: DTO Java para model Angular

Create a model in Angular using this DTO Java.
Don't use the sufix DTO in the name of interface.

```
```
