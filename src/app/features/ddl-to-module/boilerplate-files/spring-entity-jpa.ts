import { DatabaseTable } from "../database-table.model";
import { Dialect, snakeToCamelCase } from "../module-buillders";

export async function buildEntityJPAFromDdl(moduleName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);
  const idClassDeclaration = primaries.length > 1 ? `\n@IdClass(${moduleName}PK.class)` : '';

  let entityJPA = `
import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity${idClassDeclaration}
@Table(name = "${schema.table}", schema = "${schema.schema}")
@Getter
@Setter
@NoArgsConstructor
public class ${moduleName} implements Serializable {\n\n`;

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
    const primarykey = col.isPrimary ? `\t@Id\n` : '';
    const autoincrement = col.autoincrement ? `\t@GeneratedValue(strategy = GenerationType.IDENTITY)\n` : '';
    const label = col.label != null && col.label !== '' ? `\t/* ${col.label} */\n` : '';

    let colStr = `${label}${refs}${enumVals}${primarykey}${autoincrement}`;
    colStr += `\t@Column(name = "${col.column}", nullable = ${col.isNullable}${len}${unique})\n`;
    colStr += `\tprivate ${columnType} ${columnName};\n\n`;

    entityJPA += colStr;
  }

  entityJPA += '}';

  return entityJPA;
}
