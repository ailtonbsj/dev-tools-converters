import { DatabaseTable } from "../database-table.model";
import { columnToPascalFieldJava } from "../module-buillders";

export async function buildMapperFromDdl(moduleName: string, schema: DatabaseTable, ddl: string): Promise<string> {
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);

  const getIdCompound = primaries.map(p => `dto.get${columnToPascalFieldJava(p.column)}()`);

  const toIdMethod = primaries.length > 1 ? `

    default String toId(${moduleName}DTO dto) {
        var key = new ${moduleName}PK(
            ${ getIdCompound.join(', ')}
        );
        return Util.idToString(key);
    }` : '';

  return `
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import java.util.List;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING, uses = {
  GenericMapper.class
})
public interface ${moduleName}Mapper {

    ${moduleName}DTO toDto(${moduleName} domain);

    List<${moduleName}DTO> toDto(List<${moduleName}> domain);

    ${moduleName} toDomain(${moduleName}DTO dto);

    List<${moduleName}> toDomain(List<${moduleName}DTO> dto);${toIdMethod}

}`;

}
