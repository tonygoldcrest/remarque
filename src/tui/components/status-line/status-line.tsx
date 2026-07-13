import React from "react";
import { Text } from "ink";
import theme from "../../theme";
import { fit } from "../helpers";
import { Composer, DeleteRequest } from "../../types";

interface Props {
  confirm?: DeleteRequest | null;
  input?: Composer | null;
  message?: string | null;
  width: number;
}

export function StatusLine(props: Props): React.ReactElement {
  if (props.confirm) {
    return <Text color={theme.delFg}>{fit(` ${props.confirm.label} (y/N)`, props.width)}</Text>;
  }

  if (props.input) {
    const prefix =
      props.input.mode === "reply"
        ? ` reply › `
        : props.input.mode === "general"
          ? ` general comment › `
          : ` comment ${props.input.file} ${props.input.side}:${props.input.line} › `;
    const text = prefix + props.input.value;
    const room = Math.max(1, props.width - 1);
    const shown = text.length > room ? text.slice(text.length - room) : text;
    const pad = " ".repeat(Math.max(0, room - shown.length));

    return (
      <Text>
        {shown}
        <Text inverse> </Text>
        {pad}
      </Text>
    );
  }

  const help =
    " ↑↓ move  Tab side  ]f file  ]c/]t jump  c comment  - stage  ^G general  r resolve  x dismiss  o reopen  d delete  ^R reload  q quit";

  if (!props.message) {
    return <Text color={theme.hunk}>{fit(help, props.width)}</Text>;
  }

  const msg = `  ${props.message} `;
  const isError = props.message.toLowerCase().startsWith("error");
  const maxHelp = Math.max(0, props.width - msg.length);
  const helpText = help.length > maxHelp ? help.slice(0, maxHelp) : help;
  const pad = " ".repeat(Math.max(0, props.width - helpText.length - msg.length));

  return (
    <Text>
      <Text color={theme.hunk}>{helpText + pad}</Text>
      <Text color={isError ? theme.delFg : theme.borderActive}>{msg}</Text>
    </Text>
  );
}
