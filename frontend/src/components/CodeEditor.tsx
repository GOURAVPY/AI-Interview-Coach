import { indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { EditorState, StateEffect, StateField, Transaction, type Extension } from '@codemirror/state';
import { Decoration, EditorView, GutterMarker, gutter, keymap, type DecorationSet } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { Annotation } from '../types/coding';

export type EditSource = 'user' | 'ai';

// Everything the AI is allowed to do to the editor. The user can type at any time too,
// and every AI change goes into the undo history, so Ctrl+Z always gives control back.
export interface EditorHandle {
  getCode: () => string;
  setCode: (code: string, source?: EditSource) => void;
  annotate: (notes: Annotation[]) => void;
  clearAnnotations: () => void;
  revealLine: (line: number) => void;
  focus: () => void;
}

interface Props {
  initialCode: string;
  onChange: (code: string, source: EditSource) => void;
  onRun: () => void;
  label: string;
}

const setNotes = StateEffect.define<Annotation[]>();

const notesField = StateField.define<{ notes: Annotation[]; decorations: DecorationSet }>({
  create: () => ({ notes: [], decorations: Decoration.none }),
  update(value, tr) {
    let notes = value.notes;

    // Keep each note on the same line of text while the user edits above or around it.
    if (tr.docChanged && notes.length) {
      notes = notes.map((n) => {
        const from = tr.startState.doc.line(Math.min(Math.max(n.line, 1), tr.startState.doc.lines)).from;
        return { ...n, line: tr.newDoc.lineAt(tr.changes.mapPos(from)).number };
      });
    }
    for (const effect of tr.effects) if (effect.is(setNotes)) notes = effect.value;

    if (notes === value.notes) return value;

    const doc = tr.newDoc;
    const seen = new Set<number>();
    const ranges = notes
      .filter((n) => n.line >= 1 && n.line <= doc.lines && !seen.has(n.line) && seen.add(n.line))
      .sort((a, b) => a.line - b.line)
      .map((n) => Decoration.line({ class: `cm-note cm-note-${n.severity}` }).range(doc.line(n.line).from));
    return { notes, decorations: Decoration.set(ranges) };
  },
  provide: (field) => EditorView.decorations.from(field, (v) => v.decorations),
});

class NoteMarker extends GutterMarker {
  constructor(private severity: string, private message: string) {
    super();
  }
  eq(other: NoteMarker) {
    return other.severity === this.severity && other.message === this.message;
  }
  toDOM() {
    const dot = document.createElement('span');
    dot.className = `note-dot note-${this.severity}`;
    dot.title = this.message;
    return dot;
  }
}

const noteGutter = gutter({
  class: 'cm-note-gutter',
  lineMarker(view, line) {
    const lineNumber = view.state.doc.lineAt(line.from).number;
    const note = view.state.field(notesField).notes.find((n) => n.line === lineNumber);
    return note ? new NoteMarker(note.severity, note.message) : null;
  },
  lineMarkerChange: (update) => update.docChanged || update.transactions.some((t) => t.effects.some((e) => e.is(setNotes))),
  initialSpacer: () => new NoteMarker('good', ''),
});

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '14px', backgroundColor: '#fff' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.65', overflow: 'auto' },
  '.cm-gutters': { backgroundColor: 'var(--card)', color: 'rgba(20,20,20,0.45)', border: 'none', borderRight: '1px solid var(--line)' },
  '.cm-activeLine': { backgroundColor: 'rgba(203, 212, 194, 0.28)' },
  '.cm-activeLineGutter': { backgroundColor: 'rgba(203, 212, 194, 0.5)' },
  '.cm-content': { caretColor: 'var(--ink)', padding: '10px 0' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: 'rgba(20,20,20,0.14) !important' },
});

const CodeEditor = forwardRef<EditorHandle, Props>(function CodeEditor({ initialCode, onChange, onRun, label }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  onChangeRef.current = onChange;
  onRunRef.current = onRun;

  useEffect(() => {
    if (!host.current) return;

    const extensions: Extension[] = [
      basicSetup,
      javascript(),
      keymap.of([
        indentWithTab,
        {
          key: 'Mod-Enter',
          run: () => {
            onRunRef.current();
            return true;
          },
        },
      ]),
      notesField,
      noteGutter,
      theme,
      EditorView.contentAttributes.of({ 'aria-label': label }),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;
        const fromAi = update.transactions.some((tr) => tr.isUserEvent('ai'));
        onChangeRef.current(update.state.doc.toString(), fromAi ? 'ai' : 'user');
      }),
    ];

    view.current = new EditorView({ parent: host.current, state: EditorState.create({ doc: initialCode, extensions }) });
    return () => {
      view.current?.destroy();
      view.current = null;
    };
    // The editor is created once; later code changes go through the handle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    getCode: () => view.current?.state.doc.toString() ?? '',
    setCode: (code, source = 'ai') => {
      const v = view.current;
      if (!v) return;
      v.dispatch({
        changes: { from: 0, to: v.state.doc.length, insert: code },
        annotations: Transaction.userEvent.of(source === 'ai' ? 'ai' : 'input'),
      });
    },
    annotate: (notes) => view.current?.dispatch({ effects: setNotes.of(notes) }),
    clearAnnotations: () => view.current?.dispatch({ effects: setNotes.of([]) }),
    revealLine: (line) => {
      const v = view.current;
      if (!v) return;
      const info = v.state.doc.line(Math.min(Math.max(line, 1), v.state.doc.lines));
      v.dispatch({ selection: { anchor: info.from }, effects: EditorView.scrollIntoView(info.from, { y: 'center' }) });
    },
    focus: () => view.current?.focus(),
  }));

  return <div className="code-editor" ref={host} />;
});

export default CodeEditor;
