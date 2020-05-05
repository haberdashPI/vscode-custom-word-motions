// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { strict, match } from 'assert';

interface MoveByArgs{
    unit?: RegExp,
    select?: boolean,
    value?: number
    boundary?: string,
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('vscode-custom-word-motions.moveby',
        (args: MoveByArgs) => {
            let editor = vscode.window.activeTextEditor;
            if(editor){
                editor.selections = editor.selections.map(moveBy(editor,args));
            }
        }
    );

    context.subscriptions.push(disposable);
}

enum Boundary {
    Start,
    End,
    Both
}

function* unitsForDoc(document: vscode.TextDocument, from: vscode.Position,
    boundary: Boundary, unit: RegExp, forward: boolean){

    let line = from.line;
    let char = from.character;
    let str = document.lineAt(line).text
    if(forward){
        for(let pos of unitBoundaries(str,boundary,unit)){
            if(pos < char) continue;
            else yield new vscode.Position(pos,line);
        }
        while(line < document.lineCount-1){
            line++;
            str = document.lineAt(line).text;
            for(let pos of unitBoundaries(str,boundary,unit)){
                yield new vscode.Position(pos,line);
            }
        }
    }else{
        let positions = Array.from(unitBoundaries(str,boundary,unit))
        if(positions.length > 0){
            for(let pos of positions.reverse()){
                if(pos > char) continue;
                else yield new vscode.Position(pos,line);
            }
        }
        while(line > 0){
            line--;
            str = document.lineAt(line).text;
            let positions = Array.from(unitBoundaries(str,boundary,unit))
            for(let pos of positions.reverse()){
                yield new vscode.Position(pos,line);
            }
        }
    }
}


function* unitBoundaries(text: string,boundary: Boundary, unit: RegExp){
    let reg = RegExp(unit);
    let match = reg.exec(text);
    let boundaries: number[] = [];

    while(match){
        if(boundary === Boundary.Start){
            yield match.index;
        }else if(boundary === Boundary.End){
            yield match.index + match[0].length;
        }else if(boundary === Boundary.Both){
            yield match.index;
            yield match.index + match[0].length;
        }
        match = reg.exec(text);
    }
}

function first<T>(x: Iterable<T>): [IteratorResult<T,T>, Iterator<T,T>]{
    let itr: Iterator<T> = x[Symbol.iterator]()
    let result: IteratorResult<T,T> = itr.next();
    return [result, itr]
}

function moveBy(editor: vscode.TextEditor,args: MoveByArgs){
    let unit = args.unit === undefined ? /w+/ : args.unit;
    let forward = args.value === undefined ? true : args.value > 0;
    let select = args.select === undefined ? false : args.select;
    let boundary: Boundary;
    if(args.value === undefined){
        boundary = Boundary.Start;
    }else if(args.boundary === 'start'){
        boundary = Boundary.Start;
    }else if(args.boundary === 'end'){
        boundary = Boundary.End;
    }else if(args.boundary === 'both'){
        boundary = Boundary.Both;
    }else{
        vscode.window.showErrorMessage("Unexpected value for boundary argument: '"+args.boundary+"'.")
        return (select: vscode.Selection) => select;
    }
    let steps = args.value === undefined ? 1 : Math.abs(args.value);
    if(steps === 0) return (select: vscode.Selection) => select;

    return (select: vscode.Selection) => {
        // TODO: if its a default word, we take advantage
        // of language specific word definitions
        let units = unitsForDoc(editor.document,select.active,boundary,
            unit,forward);
        let count = 0;
        let pos = select.active;
        for(pos of units){
            count++;
            if(count === steps) break;
        }
        if(select){
            return new vscode.Selection(select.anchor,pos);
        }else{
            return new vscode.Selection(pos,pos);
        }
    };
}

// this method is called when your extension is deactivated
export function deactivate() {}
