import { camelToPascalCase } from "../case-util";
import { DatabaseTable, Dialect } from "../sql-datastructs/database.model";
import { columnToTypeJava } from "../sql-datastructs/datastructs";

export async function buildImplementationJPAFromDdl(moduleName: string, schema: DatabaseTable, dialect: Dialect) {
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);

  const pkType = columnToTypeJava(primaries[0], dialect);
  const typeDeclaration = primaries.length > 1 ? `${moduleName}PK` : pkType;

  const setIdCompound = primaries.map(p => `domain.set${camelToPascalCase(p.javaFieldName)}(id.get${camelToPascalCase(p.javaFieldName)}());`);
  const setIdDeclaration = primaries.length > 1 ? setIdCompound.join('\n            ') : 'domain.setId(id);';

  return `
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Example;
import org.springframework.data.domain.ExampleMatcher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ${moduleName}ServiceImpl implements ${moduleName}Service {

    private final ${moduleName}Repository repository;
    private final ${moduleName}Mapper mapper;

    @Override
    public Optional<${moduleName}DTO> show(${typeDeclaration} id) {
        return repository.findById(id).map(mapper::toDto);
    }

    @Override
    public List<${moduleName}DTO> index() {
        return mapper.toDto(repository.findAll());
    }

    @Override
    public ${moduleName}DTO create(${moduleName}DTO dto) {
        try {
            var domain = mapper.toDomain(dto);
            return mapper.toDto(repository.save(domain));
        } catch(DataIntegrityViolationException e) {
            // if(e.getCause().getMessage().contains("yor_foreign_key"))
            log.warn("{}", e.getCause().getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Violação da integridade dos dados.");
        } catch (Exception e) {
            log.warn("{}", e.getCause().getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Falha ao salvar.");
        }
    }

    @Override
    public ${moduleName}DTO update(${typeDeclaration} id, ${moduleName}DTO dto) {
        try {
            var domain = mapper.toDomain(dto);
            ${setIdDeclaration}
            return mapper.toDto(repository.save(domain));
        } catch(DataIntegrityViolationException e) {
            // if(e.getCause().getMessage().contains("yor_foreign_key"))
            log.warn("{}", e.getCause().getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Violação da integridade dos dados.");
        } catch (Exception e) {
            log.warn("{}", e.getCause().getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Falha ao atualizar.");
        }
    }

    @Override
    public boolean destroy(${typeDeclaration} id) {
        try {
            if(repository.findById(id).isEmpty()) return false;
            repository.deleteById(id);
            return true;
        } catch(DataIntegrityViolationException e) {
            // if(e.getCause().getMessage().contains("yor_foreign_key"))
            log.warn("{}", e.getCause().getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Violação da integridade dos dados.");
        } catch (Exception e) {
            log.warn("{}", e.getCause().getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Falha ao remover.");
        }
    }

    @Override
    public Page<${moduleName}DTO> search(String keyword, Pageable pageable) {
      var result = repository.findByKeyword(keyword, pageable);
      return result.map(mapper::toDto);
    }

    @Override
    public Page<${moduleName}DTO> filter(${moduleName}DTO example, Pageable pageable) {
        var domain = mapper.toDomain(example);
        ExampleMatcher matcher = ExampleMatcher.matching().withIgnoreCase()
            .withStringMatcher(ExampleMatcher.StringMatcher.CONTAINING);
        var sample = Example.of(domain, matcher);
        var result = repository.findAll(sample, pageable);
        return result.map(mapper::toDto);
    }
}
`;
}
