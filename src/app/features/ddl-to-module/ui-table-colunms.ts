export function inputText(label: string, colName: string) {
    return `
        <!-- ${label} Column -->
        <ng-container matColumnDef="${colName}">
          <th mat-header-cell *matHeaderCellDef mat-sort-header class="th-bold-center">
            ${label}
            <app-sort-icon column="${colName}" [sorts]="sorts()" />
          </th>
          <td mat-cell *matCellDef="let el" class="text-center align-middle fs-6">
            {{ el.${colName} }}
            @if (el.${colName} === null) {
            {{ dataNotFound }}
            }
          </td>
        </ng-container>`;
}

export function inputDate(label: string, colName: string) {
    return `
        <!-- ${label} Column -->
        <ng-container matColumnDef="${colName}">
          <th mat-header-cell *matHeaderCellDef mat-sort-header class="th-bold-center">
            ${label}
            <app-sort-icon column="${colName}" [sorts]="sorts()" />
          </th>
          <td mat-cell *matCellDef="let el" class="text-center align-middle fs-6">
            {{ el.${colName} | date : 'shortDate' }}
            @if (el.${colName} === null) {
            {{ dataNotFound }}
            }
          </td>
        </ng-container>`;
}

export function inputDateTime(label: string, colName: string) {
    return `
        <!-- ${label} Column -->
        <ng-container matColumnDef="${colName}">
          <th mat-header-cell *matHeaderCellDef mat-sort-header class="th-bold-center">
            ${label}
            <app-sort-icon column="${colName}" [sorts]="sorts()" />
          </th>
          <td mat-cell *matCellDef="let el" class="text-center align-middle fs-6">
            {{ el.${colName} | date : 'short' }}
            @if (el.${colName} === null) {
            {{ dataNotFound }}
            }
          </td>
        </ng-container>`;
}

export function maskedAsCurrency(label: string, colName: string) {
    return `
        <!-- ${label} Column -->
        <ng-container matColumnDef="${colName}">
          <th mat-header-cell *matHeaderCellDef mat-sort-header class="th-bold-center">
            ${label}
            <app-sort-icon column="${colName}" [sorts]="sorts()" />
          </th>
          <td mat-cell *matCellDef="let el" class="text-center align-middle fs-6">
            {{ el.${colName} | currency }}
            @if (el.${colName} === null) {
            {{ dataNotFound }}
            }
          </td>
        </ng-container>`;
}

export function staticSelect(label: string, colName: string) {
    return `
        <!-- ${label} Column -->
        <ng-container matColumnDef="${colName}">
          <th mat-header-cell *matHeaderCellDef mat-sort-header class="th-bold-center">
            ${label}
            <app-sort-icon column="${colName}" [sorts]="sorts()" />
          </th>
          <td mat-cell *matCellDef="let el" class="text-center align-middle fs-6">
            @if(el.${colName} === 'S') {
              <mat-chip highlighted color="primary">Sim</mat-chip>
            } @else if(el.${colName} === 'N') {
              <mat-chip highlighted color="warn">Não</mat-chip>
            }
            @else {
            {{ el.${colName} }}
            }
          </td>
        </ng-container>`;
}
