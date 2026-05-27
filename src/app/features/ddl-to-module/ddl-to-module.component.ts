import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Highlight } from 'ngx-highlightjs';

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
    MatSelectModule,
    Highlight
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
  protected readonly highlightedSqlInput = signal('\n');

  protected async pasteFromClipboard(): Promise<void> {
    const text = await navigator.clipboard.readText();

    if (text.trim()) {
      this.sqlInput.set(text);
      this.highlightedSqlInput.set(this.toHighlightValue(text));
    }
  }

  protected syncHighlightScroll(textarea: HTMLTextAreaElement, highlightCode: HTMLElement): void {
    highlightCode.style.transform = `translate(${-textarea.scrollLeft}px, ${-textarea.scrollTop}px)`;
  }

  protected onSqlInput(value: string, textarea: HTMLTextAreaElement, highlightCode: HTMLElement): void {
    this.sqlInput.set(value);
    this.highlightedSqlInput.set(this.toHighlightValue(value));
    this.syncHighlightScrollAfterRender(textarea, highlightCode);
  }

  protected generateBoilerplate(): void {
    return;
  }

  private syncHighlightScrollAfterRender(textarea: HTMLTextAreaElement, highlightCode: HTMLElement): void {
    requestAnimationFrame(() => {
      this.syncHighlightScroll(textarea, highlightCode);
      requestAnimationFrame(() => this.syncHighlightScroll(textarea, highlightCode));
    });
  }

  private toHighlightValue(value: string): string {
    return value || '\n';
  }
}
