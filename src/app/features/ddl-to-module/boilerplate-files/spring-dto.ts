import { DatabaseTable } from "../database-table.model";
import { columnToFieldJava, columnToTypeJava, Dialect, snakeToPascalCase } from "../module-buillders";

export async function buildSpringDTOFromDdl(moduleName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
  const entityName = snakeToPascalCase(schema.table.replace('tb_', ''));
  const columns = schema.columns;

  const properties = columns.map(col => {
    const type = columnToTypeJava(col, dialect);
    const field = columnToFieldJava(col.column);
    const label = col.label != null && col.label !== '' ? col.label : field;
    const pkValid = col.isPrimary ? `@Null(message = "O campo ${label} precisa está vazio.")\n  ` : '';
    const notBlankOrNull = ['String'].includes(type) ?
      `@NotBlank(message = "O campo ${label} não pode ser nulo ou em branco.")` : `@NotNull(message = "O campo ${label} não pode ser nulo.")`;
    const notNullValid = !col.isNullable ? `${notBlankOrNull}\n  ` : '';
    const sizeValid = col.len > 0 && ['String'].includes(type) && pkValid === '' ?
      `@Size(max = ${col.len}, message = "O campo ${label} aceita no máximo ${col.len} caracteres.")\n  ` : '';
    const scaleMessage = col.scale > 0 ? ` e ${col.scale} decimais.` : '.';
    const digitValid = col.len > 0 && ['Integer', 'Long', 'BigDecimal', 'Double'].includes(type) && pkValid === '' ?
      `@Digits(integer = ${col.len}, fraction = ${col.scale}, message = "O campo ${label} só permite ${col.len} dígitos inteiros${scaleMessage}")\n  ` : '';
    const labelComment = col.label != null && col.label !== '' ? `/* ${col.label} */\n  ` : '';

    return `${labelComment}${pkValid}${notNullValid}${sizeValid}${digitValid}private ${type} ${field};`;
  });


  return `

import jakarta.validation.constraints.*;
import lombok.*;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
public class ${moduleName}DTO implements Serializable {

  ${properties.join('\n\n  ')}

}
`;

}
