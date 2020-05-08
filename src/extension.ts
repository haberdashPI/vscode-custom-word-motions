// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { strict, match } from 'assert';

interface MoveByArgs{
    unit?: string,
    select?: boolean,
    selectWhole?: boolean,
    value?: number
    boundary?: string,
}

interface IHash<T>{
    [details: string]: T
}

interface UnitDef{
    name: string,
    regex: string,
}

let units: IHash<RegExp> = {};

function updateUnits(event?: vscode.ConfigurationChangeEvent){
    if(!event || event.affectsConfiguration("vscode-custom-word-motions")){
        let config = vscode.workspace.getConfiguration("vscode-custom-word-motions");
        let newUnits = config.get<Array<UnitDef>>("units");
        units = {};
        if(newUnits){
            for(let unit of newUnits){
                units[unit.name] = RegExp(unit.regex,"gu");
            }
        }
    }
}

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // TODO: create a way to define regex's in settings.json
    updateUnits();
    vscode.workspace.onDidChangeConfiguration(updateUnits);

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    let disposable = vscode.commands.registerCommand('vscode-custom-word-motions.moveby',
        (args: MoveByArgs) => {
            let editor = vscode.window.activeTextEditor;
            if(editor){
                editor.selections = editor.selections.map(moveBy(editor,args));
                editor.revealRange(editor.selection);
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
            else yield new vscode.Position(line,pos);
        }
        while(line < document.lineCount-1){
            line++;
            str = document.lineAt(line).text;
            for(let pos of unitBoundaries(str,boundary,unit)){
                yield new vscode.Position(line,pos);
            }
        }
    }else{
        let positions = Array.from(unitBoundaries(str,boundary,unit))
        if(positions.length > 0){
            for(let pos of positions.reverse()){
                if(pos > char) continue;
                else yield new vscode.Position(line,pos);
            }
        }
        while(line > 0){
            line--;
            str = document.lineAt(line).text;
            let positions = Array.from(unitBoundaries(str,boundary,unit))
            for(let pos of positions.reverse()){
                yield new vscode.Position(line,pos);
            }
        }
    }
}


function* unitBoundaries(text: string,boundary: Boundary, unit: RegExp){
    let reg = RegExp(unit);
    reg.lastIndex = 0;
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
    let unit = args.unit === undefined ? /\p{L}+/gu : units[args.unit];
    let forward = args.value === undefined ? true : args.value > 0;
    let holdSelect = args.select === undefined ? false : args.select;
    let selectWholeUnit = args.selectWhole === undefined ? false : args.selectWhole;

    let boundary: Boundary;
    if(args.boundary === undefined){
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
        let start: vscode.Position | undefined = undefined;
        if(selectWholeUnit){
            let units = unitsForDoc(editor.document,select.active,boundary,
                unit,!forward);
            let [firstUnit, _] = first(units);
            if(!firstUnit.done) start = firstUnit.value;
        }else if(holdSelect){
            start = select.anchor;
        }

        let units = unitsForDoc(editor.document,select.active,boundary,
            unit,forward);
        let count = 0;
        let pos = select.active;
        for(pos of units){
            if(!pos.isEqual(select.active)) count++;
            if(count === steps) break;
        }
        if(start){
            return new vscode.Selection(start,pos);
        }else{
            return new vscode.Selection(pos,pos);
        }
    };
}

// this method is called when your extension is deactivated
export function deactivate() {}
