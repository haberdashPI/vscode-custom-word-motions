# Custom Word Motions for VSCode

Prefer vim-style word motion, emacs-style, or your-own-style? This is the
extension for you.

The extension allows you to specify a set of regular expressions in your settings
file and move the cursor or a selection in reference to the boundaries of these
expressions.

There are two commands: `vscode-custom-word-motions.moveby` and
`vscode-custom-word-motions.narrowto`. Both properly handle multiple cursors.

## Defining regular expressions

These are defined in your settings file (open with the command `Preferences:
Open Settings (JSON)`), using `vscode-custom-word-motions.units`. This setting
is an array with entries containing a `name` and a `regex` value. Each regex is
compiled with the g and u flags (global search and unicode support). For
example, my settings include the following.

```json

"vscode-custom-word-motions.units": [
    {"name": "WORD", "regex": "[^\\s]+"},
    {"name": "word", "regex": "([/\\p{L}][_\\p{L}0-9]*)|([0-9][0-9.]*)|((?<=[\\s\\r\\n])[^\\p{L}^\\s]+(?=[\\s\\r\\n]))"},
    {"name": "subword", "regex": "(\\p{L}[0-9\\p{Ll}]+)|(\\p{Lu}[\\p{Lu}0-9]+(?!\\p{Ll}))|(\\p{L})|(_+)|([^\\p{L}^\\s^0-9])|([0-9][0-9.]*)"},
    {"name": "subident", "regex": "(\\p{L}[0-9\\p{Ll}]+)|(\\p{Lu}[\\p{Lu}0-9]+(?!\\p{Ll}))|(\\p{L})|([0-9][0-9.]*)"},
    {"name": "number", "regex": "[0-9][0-9.]*"},
    {"name": "space", "regex": "\\s+"},
    {"name": "punctuation", "regex": "[^\\p{L}\\s]+"}
],

```

You can also define multi-line units; see below.

## The `moveby` command

The `moveby` command moves the cursor according to one of the regular expressions
you defined in your settings. It takes five optional arguments.

- `unit`: The name of the regex to move by. If not specified
the regex `\p{L}+` is used.
- `select`: Set to true if you want the motion to expand the current selection.
- `value`: The number of boundaries to move by. Negative values move left,
  positive move right. Defaults to 1.
- `boundary`: The boundaries to stop at when moving: this can be the `start`,
  `end` or `both` boundaries of the regex. Defaults to `start`.
- `selectWhole`: If specified, the behavior of this command changes. Instead of
  moving the cursor, it will create a selection at the specified
  boundaries of the regex currently under the cursor, unless it is already
  selected. If it is, the next such regex is selected.

For example to move the cursor to the start of the next number, (using the regex
definitions provided above), using `ctrl+#` you could define the following
command in your `keybindings.json` file.

```json
{
    "command": "vscode-custom-word-motions.moveby",
    "args": { "unit": "number" },
    "key": "ctrl+shift+3"
}
```

## The `narrowto` command

The `narrowto` command shrinks the current boundaries of the current selection
until it is directly at the given boundaries of the regular expression. It
takes four optional arguments.

- `unit`: The name of the regex to move by. If not specified
  the regex `\p{L}+` is used.
- `boundary`: The boundaries to consider when moving: this can be the `start`,
  `end` or `both` boundaries of the regex. Defaults to `start`.
- `then`: If the selection is already at the boundaries of `unit`, you can
  specify a second regex to narrow the selection by here.
- `thenBoundary`: The boundaries to use for `then` if different
from those specified for `boundary`.

For example, to narrow the boundaries of the selection to lie at non-white-space characters by
pressing `cmd+(` you could add the following to `keybindings.json`.

```json
{
    "command": "vscode-custom-word-motions.narrowto",
    "args": { "unit": "WORD" },
    "key": "shift+cmd+9",
}
```

## Multi-line units

This extension now supports defining units for multi-line matches.

To use this feature change the unit entry to use `regexs` instead of `regex`.

If a single regular expression is provided, the match will occur to a contiguous series of
lines which all match that expression. If multiple expressions are provided, the match will
occur to a sequence of lines that match those expressions.

For instance, to select a group of contiguous non-whitespace lines with "cmd+shift+[" you
could add the following definition to preferences.

```json
"vscode-custom-word-motions.units": [
    {"name": "paragraph", "regexs": "\\S+"},
]
```

Then add the following definition to keybindings.json

```json
{
    "command": "vscode-custom-word-motions.moveby",
    "args": { "unit": "paragraph", "selectWhole": true },
    "key": "shift+cmd+9",
}
```

Or, for instance, you could selection sections of code separated by comment headers

```json
"vscode-custom-word-motions.units": [
    {"name": "section", "regexs": [".+", "^.*------.*$"]}
]"
```

Where a section header looks like this

```javascript
// My section
// -----------------------------------------------------------------
```

You could then select all code in the section using a keybinding like follows.

```json
{
    "command": "vscode-custom-word-motions.moveby",
    "args": { "unit": "section", "boundary": "start", "selectWhole": true },
    "key": "shift+cmd+0",
}
```
