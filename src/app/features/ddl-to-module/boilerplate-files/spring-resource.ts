import { plural } from "@umatch/pluralize-ptbr";
import { DatabaseTable, Dialect } from "../sql-datastructs/database.model";
import { columnToFieldJava, columnToTypeJava } from "../sql-datastructs/datastructs";
import { pascalToKebabCase, pascalToSnakeCase } from "../case-util";

export async function buildResourceFromDdl(moduleName: string, humanName: string, schema: DatabaseTable, dialect: Dialect) {
  const pluralKebabName = plural(pascalToKebabCase(moduleName));
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);

  const pkType = columnToTypeJava(primaries[0], dialect);
  const typeDeclaration = primaries.length > 1 ? 'String' : pkType;
  const keyDeclaration = primaries.length > 1 ? `\n        var key = Util.stringToId(id, ${moduleName}PK.class);` : '';
  const idDeclaration = primaries.length > 1 ? `Util.stringToId(id, ${moduleName}PK.class)` : 'id';

  const pkId = columnToFieldJava(primaries[0].column);

  const moduleNameSnakeUp = pascalToSnakeCase(moduleName).toUpperCase();

  return `
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.util.List;

@Tag(name = "${humanName}")
@RestController
@RequestMapping("${pluralKebabName}")
@RequiredArgsConstructor
public class ${moduleName}Resource {

    private final ${moduleName}Service service;
    private final ${moduleName}Mapper mapper;

    //@PreAuthorize("hasRole('${moduleNameSnakeUp}_VER')")
    @GetMapping("{id}")
    @Operation(summary = "Obtem um registro pelo ID")
    public ResponseEntity<${moduleName}DTO> show(@PathVariable ${typeDeclaration} id) {${keyDeclaration}
        return service.show(${primaries.length > 1 ? 'key' : 'id'})
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    //@PreAuthorize("hasRole('${moduleNameSnakeUp}_VER')")
    @GetMapping
    @ResponseStatus(value = HttpStatus.OK)
    @Operation(summary = "Lista todos registros")
    public List<${moduleName}DTO> index() {
        return service.index();
    }

    //@PreAuthorize("hasRole('${moduleNameSnakeUp}_INSERIR')")
    @PostMapping
    @Operation(summary = "Cria novo registro")
    public ResponseEntity<${moduleName}DTO> create(@Valid @RequestBody ${moduleName}DTO dto) {
        var created = service.create(dto);
        var location = ServletUriComponentsBuilder
            .fromCurrentRequest().path("/{id}").buildAndExpand(${primaries.length > 1 ? 'mapper.toId(created)' : 'dto.getId()'}).toUri();
        return ResponseEntity.created(location).body(created);
    }

    //@PreAuthorize("hasRole('${moduleNameSnakeUp}_EDITAR')")
    @PutMapping("{id}")
    @Operation(summary = "Atualiza um registro por completo")
    public ResponseEntity<${moduleName}DTO> update(@PathVariable ${typeDeclaration} id, @Valid @RequestBody ${moduleName}DTO dto) {
        var updated = service.update(${idDeclaration}, dto);
        return ResponseEntity.ok(updated);
    }

    //@PreAuthorize("hasRole('${moduleNameSnakeUp}_REMOVER')")
    @DeleteMapping("{id}")
    @Operation(summary = "Remove um registro pelo ID")
    public ResponseEntity<Void> destroy(@PathVariable ${typeDeclaration} id) {
        if (service.destroy(${idDeclaration})) return ResponseEntity.ok().build();
        return ResponseEntity.notFound().build();
    }

    //@PreAuthorize("hasRole('${moduleNameSnakeUp}_VER')")
    @GetMapping("search")
    @ResponseStatus(value = HttpStatus.OK)
    @Operation(summary = "Busca registros por palavra-chave")
    public Page<${moduleName}DTO> search(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") Integer pageNumber,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(defaultValue = "asc") String[] directions,
            @RequestParam(defaultValue = "id") String[] sortProps
    ){
        Sort sort = Util.directionPropsToOrders(directions, sortProps, ${moduleName}.class);
        Pageable pageable = PageRequest.of(pageNumber, pageSize, sort);
        return service.search(keyword, pageable);
    }

    //@PreAuthorize("hasRole('${moduleNameSnakeUp}_VER')")
    @GetMapping("filter")
    @ResponseStatus(value = HttpStatus.OK)
    @Operation(summary = "Filtra registros por exemplo")
    public Page<${moduleName}DTO> filter(
            ${moduleName}DTO example,
            @RequestParam(defaultValue = "0") Integer pageNumber,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(defaultValue = "asc") String[] directions,
            @RequestParam(defaultValue = "id") String[] sortProps) {
        var sort = Util.directionPropsToOrders(directions, sortProps);
        var pageable = PageRequest.of(pageNumber, pageSize, sort);
        return service.filter(example, pageable);
    }

}
`;
}
