import React from 'react';
import * as monaco from 'monaco-editor';

export function JsonEditorPanel(props: { model: monaco.editor.ITextModel }): JSX.Element {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const editorRef = React.useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const modelRef = React.useRef(props.model);

  React.useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }

    monaco.editor.setTheme('vs-dark');

    const editor = monaco.editor.create(container, {
      model: modelRef.current,
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'off'
    });

    editorRef.current = editor;

    return () => {
      editorRef.current = null;
      editor.dispose();
    };
  }, []);

  React.useEffect(() => {
    modelRef.current = props.model;
    editorRef.current?.setModel(props.model);
  }, [props.model]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
}
