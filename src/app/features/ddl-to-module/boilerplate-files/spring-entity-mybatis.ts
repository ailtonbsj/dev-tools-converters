import { snakeToCamelCase, snakeToPascalCase } from "../case-util";
import { DatabaseTable, Dialect } from "../sql-datastructs/database.model";

export async function buildEntityMyBatisFromDdl(schema: DatabaseTable, dialect: Dialect): Promise<string> {

  const entityName = snakeToPascalCase(schema.table.replace('tb_', ''));
  let entity = `
import lombok.*;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
public class ${entityName} implements Serializable {\n\n`;

  for(const col of schema.columns) {
    const unique = col.isUnique ? `, unique = true` : '';
    let normalizedColunm = col.column.toLowerCase()
      .replaceAll(/^ci_|^cd_|^nr_|^nm_|^dt_|^ds_|^fl_|^tp_|^hr_|^vr_|^vl_/g,'') + ((/^cd_/i).test(col.column.toLowerCase()) ? 'Id' : '');
    normalizedColunm = col.column.toLowerCase().includes('ci_') ? 'id' : normalizedColunm;
    const columnName = snakeToCamelCase(normalizedColunm);
    let columnType = 'UNKNOWN_TYPE';
    let len = '';
    switch (col.type.toLowerCase()) {
      case 'varchar2':
      case 'varchar':
      case 'bpchar':
      case 'text':
        columnType = col.len === 1 ? 'Character' : 'String';
        len = col.len ? `, length = ${col.len}` : '';
        break;
      case 'numeric':
      case 'real':
      case 'double precision':
      case 'number':
        if(col.scale > 0) {
          columnType = 'BigDecimal';
          len = col.len ? `, precision = ${col.len}, scale = ${col.scale}`: '';
        } else if(col.len > 18) {
          columnType = 'BigDecimal';
          len = col.len ? `, precision = ${col.len}, scale = ${col.scale}`: '';
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
        columnType = dialect === 'oracle' ? 'LocalDateTime' : 'LocalDate';
        break;
      case 'bool':
      case 'boolean':
        columnType = 'Boolean';
        break;
      default:
        console.log(col.type);
    }
    const refs = col.references ? `\t// References: ${col.references}\n` : '';
    const enumVals = col.allowValues ? `\t// Enum: ${col.allowValues.join(', ')}\n` : '';
    const primarykey = col.isPrimary ? `\t// Primary Key\n` : '';
    const label = col.label != null && col.label !== '' ? `\t/* ${col.label} */\n` : '';

    let colStr = `${label}${refs}${enumVals}${primarykey}`;
    colStr += `\t// Column(name = "${col.column}", nullable = ${col.isNullable}${len}${unique})\n`;
    colStr += `\tprivate ${columnType} ${columnName};\n\n`;

    entity += colStr;
  }

  entity += '}';

  return entity;
}
