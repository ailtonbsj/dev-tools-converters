import { DatabaseTable, Dialect } from "../sql-datastructs/database.model";

export async function buildEntityJPAFromDdl(moduleName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);
  const idClassDeclaration = primaries.length > 1 ? `\n@IdClass(${moduleName}PK.class)` : '';

  const fields = schema.columns.map(col => {
    const unique = col.isUnique ? `, unique = true` : '';
    const columnName = col.javaFieldName;
    let columnType = col.javaType;
    let len = '';
    if(col.len) {
      if(['Character', 'String'].includes(columnType)) len = `, length = ${col.len}`;
      if(['BigDecimal'].includes(columnType)) len = `, precision = ${col.len}, scale = ${col.scale}`;
    }
    const refs = col.references ? `\t// References: ${col.references}\n` : '';
    const enumVals = col.allowValues ? `\t// Enum: ${col.allowValues.join(', ')}\n` : '';
    const primarykey = col.isPrimary ? `\t@Id\n` : '';
    const autoincrement = col.autoincrement ? `\t@GeneratedValue(strategy = GenerationType.IDENTITY)\n` : '';
    const label = col.label != null && col.label !== '' ? `\t/* ${col.label} */\n` : '';

    let colStr = `${label}${refs}${enumVals}${primarykey}${autoincrement}`;
    colStr += `\t@Column(name = "${col.column}", nullable = ${col.isNullable}${len}${unique})\n`;
    colStr += `\tprivate ${columnType} ${columnName};`;

    return colStr;
  });

  return `
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
public class ${moduleName} implements Serializable {

${fields.join('\n\n')}

}`;
}
