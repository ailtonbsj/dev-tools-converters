import { camelToPascalCase } from "../case-util";
import { DatabaseTable } from "../sql-datastructs/database.model";

export async function buildMapperFromDdl(moduleName: string, schema: DatabaseTable, ddl: string): Promise<string> {
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);

  const mappingIdCompound = primaries.length > 1 ? `\n    @Mapping(target = "id", expression = "java(toId(domain))")` : '';

  const getIdCompound = primaries.map(p => `model.get${camelToPascalCase(p.javaFieldName)}()`);

  const toIdMethod = primaries.length > 1 ? `

    default String toId(${moduleName}DTO model) {
        var key = new ${moduleName}PK(
            ${ getIdCompound.join(', ')}
        );
        return Util.idToString(key);
    }

    default String toId(${moduleName} model) {
        var key = new ${moduleName}PK(
            ${ getIdCompound.join(', ')}
        );
        return Util.idToString(key);
    }` : '';

  return `
import org.mapstruct.*;
import org.mapstruct.MappingConstants;
import java.util.List;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING, uses = {
  GenericMapper.class
})
public interface ${moduleName}Mapper {
${mappingIdCompound}
    ${moduleName}DTO toDto(${moduleName} domain);

    List<${moduleName}DTO> toDto(List<${moduleName}> domain);

    ${moduleName} toDomain(${moduleName}DTO dto);

    List<${moduleName}> toDomain(List<${moduleName}DTO> dto);${toIdMethod}

}`;

}
