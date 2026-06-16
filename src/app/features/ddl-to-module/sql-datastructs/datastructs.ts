import { snakeToCamelCase } from "../case-util";
import { DatabaseTable, DatabaseTableColunm, Dialect, JavaType } from "./database.model";
import { PgParser } from '@supabase/pg-parser';

export function calculateLenChars(len: number, type: string) {
  if(len != null && len > 0) return len;
  // Postgres
  else if(['smallint', 'smallserial'].includes(type)) return 4;
  else if(['integer', 'serial'].includes(type)) return 9;
  else if(['bigint', 'bigserial'].includes(type)) return 18;
  else if(['decimal', 'numeric', 'text'].includes(type)) return 999;
  else if(['real'].includes(type)) return 6;
  else if(['double precision'].includes(type)) return 15;
  else if(['money'].includes(type)) return 19;
  else if(['char', 'character', 'boolean'].includes(type)) return 1;
  else if(['timestamp'].includes(type)) return 19; // YYYY-MM-DDTHH:mm:ss
  else if(['date'].includes(type)) return 10; // YYYY-MM-DD
  else if(['time'].includes(type)) return 8; // HH:mm:ss
  else return 9;
}

export function columnToTypeJava(col: DatabaseTableColunm, dialect: Dialect) {
  let columnType = 'UNKNOWN_TYPE';
  switch (col.type.toLowerCase()) {
    case 'varchar2':
    case 'varchar':
    case 'bpchar':
    case 'text':
      columnType = col.len === 1 ? 'Character' : 'String';
      break;
    case 'numeric':
    case 'real':
    case 'double precision':
    case 'number':
      if(col.scale > 0) {
        columnType = 'BigDecimal';
      } else if(col.len > 18) {
        columnType = 'BigDecimal';
      }
      else if(col.len > 9) columnType = 'Long';
      else columnType = 'Integer';
      break;
    case 'bigserial':
    case 'bigint':
    case 'serial8':
    case 'int8':
      columnType = 'Long';
      break;
    case 'serial':
    case 'smallserial':
    case 'integer':
    case 'smallint':
    case 'serial4':
    case 'int4':
      columnType = 'Integer';
      break;
    case 'timestamp':
      columnType = 'LocalDateTime';
      break;
    case 'date':
      if(col.uiComponent === 'inputDate') columnType = 'LocalDate';
      else columnType = dialect === 'oracle' ? 'LocalDateTime' : 'LocalDate';
      break;
    case 'bool':
    case 'boolean':
      columnType = 'Boolean';
      break;
    default:
      console.log(col.type);
  }
  return columnType;
}

export function columnToFieldJava(columnOfTable: string) {
  return snakeToCamelCase(normalizeColumnOfTable(columnOfTable));
}

export function normalizeColumnOfTable(snakeColunm: string) {
  let res = snakeColunm.toLowerCase().replaceAll(/^ci_|^cd_|^nr_|^nm_|^dt_|^ds_|^fl_|^tp_|^hr_|^vr_|^vl_/g,'') +
    ((/^cd_/i).test(snakeColunm.toLowerCase()) ? 'Id' : '');
    return snakeColunm.toLowerCase().includes('ci_') ? 'id' : res;
}

export async function sqlCreateTableToAST(ddl: string, dialect: Dialect): Promise<DatabaseTable> {
  const parser = new PgParser({ version: 17 });
  const { tree } = await parser.parse(ddl);
  if(tree == null || tree.stmts == null || tree.stmts[0].stmt == null) {
    window.alert('Falha ao converter SQL. Verifique se é um DDL Create válido.');
    return {} as DatabaseTable;
  }
  const createStmt = (tree.stmts[0].stmt as any).CreateStmt;
  const tableElts = createStmt.tableElts;

  const schema = {} as DatabaseTable;
  schema.schema = createStmt.relation.schemaname.toLowerCase();
  schema.table = createStmt.relation.relname.toLowerCase();
  schema.columns = [];

  for(const elt of tableElts) {
    if(elt.ColumnDef) {
      const columnDef = elt.ColumnDef;

      let schemaCol = {} as DatabaseTableColunm;
      schemaCol.isNullable = true;
      schemaCol.isUnique = false;
      schemaCol.isPrimary = false;
      schemaCol.column =  columnDef.colname.toLowerCase();
      schemaCol.type = columnDef.typeName.names.at(-1).String.sval;
      if((/serial/i).test(schemaCol.type)) schemaCol.autoincrement = true;

      if(columnDef.typeName.typmods) {
        schemaCol.len = columnDef.typeName.typmods[0].A_Const.ival.ival;
        schemaCol.scale = columnDef.typeName.typmods[1] ? columnDef.typeName.typmods[1].A_Const.ival.ival : 0;
      }
      if(columnDef.constraints) {
        for(const constraint of columnDef.constraints) {
          if(constraint.Constraint.contype === 'CONSTR_NOTNULL') schemaCol.isNullable = false;
          if(constraint.Constraint.contype === 'CONSTR_PRIMARY') schemaCol.isPrimary = true;
        }
      }
      schemaCol.lenChars = calculateLenChars(schemaCol.len, schemaCol.type);
      schema.columns.push(schemaCol);
    } else if (elt.Constraint) {
      if(elt.Constraint.contype === 'CONSTR_UNIQUE') {
        for(const key of elt.Constraint.keys) {
          const schemaCol = schema.columns.find((c: any) => c.column === key.String.sval.toLowerCase());
          if(schemaCol) schemaCol.isUnique = true;
        }
      } else if(elt.Constraint.contype === 'CONSTR_PRIMARY') {
        for(const key of elt.Constraint.keys) {
          const schemaCol = schema.columns.find((c: any) => c.column === key.String.sval.toLowerCase());
          if(schemaCol) {
            schemaCol.isPrimary = true;
            schemaCol.isNullable = false;
            schemaCol.isUnique = true;
          }
        }
      } else if(elt.Constraint.contype === 'CONSTR_FOREIGN') {
        for(const attr of elt.Constraint.fk_attrs) {
          const schemaCol = schema.columns.find((c: any) => c.column === attr.String.sval.toLowerCase());
          const refTable = elt.Constraint.pktable;
          if(schemaCol)
            schemaCol.references = refTable.schemaname + '.' + refTable.relname + '(' + elt.Constraint.pk_attrs.map((a: any) => a.String.sval).join(',') + ')';
        }
      } else if(elt.Constraint.contype === 'CONSTR_CHECK') { // Oracle constraints
        const rawExpr = elt.Constraint.raw_expr;
        if(rawExpr.NullTest && rawExpr.NullTest.nulltesttype === 'IS_NOT_NULL') {
          if(rawExpr.NullTest.arg.ColumnRef) {
            const col = rawExpr.NullTest.arg.ColumnRef.fields[0].String.sval.toLowerCase();
            const schemaCol = schema.columns.find((c: any) => c.column.toLowerCase() === col);
            if(schemaCol) schemaCol.isNullable = false;
          } else window.alert('Simplifique as constraints mais complexas!');
        } else if(rawExpr.A_Expr && rawExpr.A_Expr.kind === 'AEXPR_IN') {
          const col = rawExpr.A_Expr.lexpr.ColumnRef.fields[0].String.sval.toLowerCase();
          const schemaCol = schema.columns.find((c: any) => c.column.toLowerCase() === col);
          const enumObj = rawExpr.A_Expr.rexpr.List.items.map((i: any) => i.A_Const.sval.sval);
          if(schemaCol && enumObj instanceof Array) schemaCol.allowValues = [...enumObj];
        } else if(rawExpr.A_Expr && rawExpr.A_Expr.kind === 'AEXPR_OP') {
          window.alert('Constraints de operações não são analisadas!');
        } else {
          console.log(elt.Constraint)
        }
      } else {
        console.log(elt.Constraint)
      }
    }
  }

  const commentColStmts = (tree.stmts as [any])
    .filter(stmtItem => stmtItem.stmt != null && stmtItem.stmt.CommentStmt != null && stmtItem.stmt.CommentStmt.objtype === 'OBJECT_COLUMN').map(s => s.stmt.CommentStmt);
  commentColStmts.map(com => {
    const comment = com.comment;
    const col = com.object.List.items[2].String.sval;
    const schemaCol = schema.columns.find(i => i.column === col);
    if(schemaCol) schemaCol.comment = comment;
    if(schemaCol && comment.includes('Label:')) schemaCol.label = comment.split('Label:')[1].split(',')[0].trim();
    if(schemaCol && comment.includes('UI:')) {
      schemaCol.uiComponent = comment.split('UI:')[1].split(',')[0].trim();
    }
  })

  schema.columns.map(col => col.javaType = columnToTypeJava(col, dialect) as JavaType);
  schema.columns.map(col => col.javaFieldName = columnToFieldJava(col.column));

  return schema;
}
