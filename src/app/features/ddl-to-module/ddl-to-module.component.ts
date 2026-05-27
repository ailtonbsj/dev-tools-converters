import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

type Dialect = 'postgresql' | 'oracle';

@Component({
  selector: 'app-ddl-to-module',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './ddl-to-module.component.html',
  styleUrl: './ddl-to-module.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DdlToModuleComponent {
  protected readonly dialect = signal<Dialect>('postgresql');
  protected readonly pascalCaseModuleName = signal('');
  protected readonly humanModuleName = signal('');
  protected readonly sqlInput = signal('');

  protected async pasteFromClipboard(): Promise<void> {
    const text = await navigator.clipboard.readText();

    if (text.trim()) {
      this.sqlInput.set(text);
    }
  }

  protected generateBoilerplate(): void {
    return;
  }
}
