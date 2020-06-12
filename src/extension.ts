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

interface NarrowByArgs{
    unit?: string,
    then?: string,
    thenBoundary?: string,
    boundary?: string,
}

interface IHash<T>{
    [details: string]: T
}

interface UnitDef{
    name: string,
    regex: string,
}


interface MultiUnitDef {
    name: string,
    regexs: string,
}

let units: IHash<RegExp | MultiLineUnit> = {};

function updateUnits(event?: vscode.ConfigurationChangeEvent){
    if(!event || event.affectsConfiguration("vscode-custom-word-motions")){
        let config = vscode.workspace.getConfiguration("vscode-custom-word-motions");
        let newUnits = config.get<Array<UnitDef | MultiUnitDef>>("units");
        units = {};
        if(newUnits){
            for(let unit of newUnits){
                if((unit as UnitDef).regex){
                    units[unit.name] = RegExp((unit as UnitDef).regex,"gu");
                }else if((unit as MultiUnitDef).regexs){
                    units[unit.name] = {
                        regexs: RegExp((unit as MultiUnitDef).regexs,"u")
                    };
                }else{
                    vscode.window.showErrorMessage("Malformed unit definition");
                }
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
    let command = vscode.commands.registerCommand('vscode-custom-word-motions.moveby',
        (args: MoveByArgs) => {
            let editor = vscode.window.activeTextEditor;
            if(editor){
                editor.selections = editor.selections.map(moveBy(editor,args));
                editor.revealRange(editor.selection);
            }
        }
    );
    context.subscriptions.push(command);

    command = vscode.commands.registerCommand('vscode-custom-word-motions.narrowto',
        (args: NarrowByArgs) => {
            let editor = vscode.window.activeTextEditor;
            if(editor){
                editor.selections = editor.selections.map(narrowTo(editor,args));
                editor.revealRange(editor.selection);
            }
        }
    );
    context.subscriptions.push(command);
}

enum Boundary { Start, End, Both }

interface MultiLineUnit { regexs: RegExp, }

function* multiLineUnitsForDoc(document: vscode.TextDocument, from: vscode.Position,
    boundary: Boundary, unit: MultiLineUnit, forward: boolean):
    Generator<[vscode.Position, Boundary]>{

    let lineNum = from.line;
    let start = lineNum;
    let lines: string[] = [];
    let lastBoundary = forward ? Boundary.End : Boundary.Start;
    while(forward ? lineNum < document.lineCount : lineNum >= 0){
        let line = document.lineAt(lineNum).text;
        if(unit.regexs.test(line)){
            lines.push(line);
        }else if(lines.length > 0){
            let startPos = forward ? new vscode.Position(start,0) :
                new vscode.Position(lineNum,0);
            let endchar = forward ?
                document.lineAt(Math.max(0,lineNum-1)).range.end.character :
                document.lineAt(Math.min(document.lineCount-1,start+1)).
                    range.end.character;
            let endPos = forward ?
                new vscode.Position(lineNum-1,endchar) :
                new vscode.Position(start,endchar);
            if(boundary !== Boundary.End &&
               (!forward || startPos.isAfterOrEqual(from))){

                lastBoundary = Boundary.Start;
                yield [startPos, Boundary.Start];
            }
            if(boundary !== Boundary.Start &&
                (forward || endPos.isBeforeOrEqual(from))){

                lastBoundary = Boundary.End;
                yield [endPos, Boundary.End];
            }
            lines = [];
            start = forward ? lineNum+1 : lineNum-1;
        }
        forward ? lineNum++ : lineNum--;
    }
    // handle boundaries at start and end of document
    let documentBoundary = forward ?
        new vscode.Position(document.lineCount-1,
            document.lineAt(document.lineCount-1).range.end.character) :
        new vscode.Position(0,0);
    yield [documentBoundary, boundary !== Boundary.Both ? boundary :
        lastBoundary];
    return;
}

function unitsForDoc(document: vscode.TextDocument, from: vscode.Position,
    boundary: Boundary, unit: RegExp | MultiLineUnit | string[], forward: boolean){

    if(unit instanceof RegExp){
        return singleLineUnitsForDoc(document, from, boundary, unit, forward);
    }else{
        return multiLineUnitsForDoc(document, from, boundary, unit as MultiLineUnit,
            forward);
    }
}

function* singleLineUnitsForDoc(document: vscode.TextDocument, from: vscode.Position,
    boundary: Boundary, unit: RegExp, forward: boolean):
    Generator<[vscode.Position, Boundary]>{

    let line = from.line;
    let char = from.character;
    let str = document.lineAt(line).text;
    if(forward){
        for(let [pos, bound] of unitBoundaries(str,boundary,unit)){
            if(pos < char) continue;
            else yield [new vscode.Position(line,pos), bound];
        }
        while(line < document.lineCount-1){
            line++;
            str = document.lineAt(line).text;
            for(let [pos, bound] of unitBoundaries(str,boundary,unit)){
                yield [new vscode.Position(line,pos), bound];
            }
        }
        let finalChar = document.lineAt(document.lineCount-1).range.end.character;
        yield [new vscode.Position(document.lineCount-1,finalChar),
                boundary === Boundary.Both ? Boundary.End : boundary];
    }else{
        let positions = Array.from(unitBoundaries(str,boundary,unit))
        if(positions.length > 0){
            for(let [pos, bound] of positions.reverse()){
                if(pos > char) continue;
                else yield [new vscode.Position(line,pos), bound];
            }
        }
        while(line > 0){
            line--;
            str = document.lineAt(line).text;
            let positions = Array.from(unitBoundaries(str,boundary,unit))
            for(let [pos, bound] of positions.reverse()){
                yield [new vscode.Position(line,pos), bound];
            }
        }
        yield [new vscode.Position(0,0),
            boundary === Boundary.Both ? Boundary.Start : boundary];
    }
}


function* unitBoundaries(text: string,boundary: Boundary, unit: RegExp): Generator<[number, Boundary]>{
    let reg = RegExp(unit);
    reg.lastIndex = 0;
    let match = reg.exec(text);
    let boundaries: number[] = [];

    while(match){
        if(boundary === Boundary.Start){
            yield [match.index, Boundary.Start];
        }else if(boundary === Boundary.End){
            yield [match.index + match[0].length, Boundary.End];
        }else if(boundary === Boundary.Both){
            yield [match.index, Boundary.Start];
            yield [match.index + match[0].length, Boundary.End];
        }
        match = reg.exec(text);
    }
}

function first<T>(x: Iterable<T>): T | undefined {
    let itr: Iterator<T> = x[Symbol.iterator]();
    let result: IteratorResult<T,T> = itr.next();
    if(!result.done){
        return result.value;
    }else{
        return undefined;
    }
}

function narrowTo(editor: vscode.TextEditor, args: NarrowByArgs): (select: vscode.Selection) => vscode.Selection {
    let unit = args.unit === undefined ? /\p{L}+/gu : units[args.unit];
    let thenNarrow = args.then === undefined ? undefined :
        narrowTo(editor, {
            unit: args.then,
            boundary: args.thenBoundary === undefined ? args.boundary :
                args.thenBoundary
        });

    let boundary: Boundary;
    if(args.boundary === undefined){
        boundary = Boundary.Both;
    }else if(args.boundary === 'start'){
        boundary = Boundary.Start;
    }else if(args.boundary === 'end'){
        boundary = Boundary.End;
    }else if(args.boundary === 'both'){
        boundary = Boundary.Both;
    }else{
        vscode.window.showErrorMessage("Unexpected value for boundary argument: '"+args.boundary+"'.");
        return (select: vscode.Selection) => select;
    }

    return (select: vscode.Selection) => {
        if(select.anchor.isEqual(select.active)){
            return select;
        }
        let starts = unitsForDoc(editor.document,select.start,
            boundary === Boundary.Both ? Boundary.Start : boundary,
            unit,true);
        let step = first(starts);
        let start = step === undefined ? select.start : step[0];

        let stops = unitsForDoc(editor.document,select.end,
            boundary === Boundary.Both ? Boundary.End : boundary,
            unit,false);
        step = first(stops);
        let stop = step === undefined ? select.end : step[0];

        if(stop.isEqual(select.end) && start.isEqual(select.start)){
            if(thenNarrow){ return thenNarrow(select); }
        }
        if(select.anchor.isBefore(select.active)){
            return new vscode.Selection(start,stop);
        }else{
            return new vscode.Selection(stop,start);
        }
    };
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
            let value = first(units);
            if(value !== undefined) [start] = value;
        }else if(holdSelect){
            start = select.anchor;
        }

        let units = unitsForDoc(editor.document,select.active,boundary,
            unit,forward);
        let count = 0;
        let pos = select.active;
        let bound: Boundary;
        for([pos, bound] of units){
            if(forward ? bound === Boundary.Start : bound === Boundary.End){
                if(selectWholeUnit && boundary === Boundary.Both){
                    start = pos;
                }
            }
            if(!pos.isEqual(select.active)){
                if(selectWholeUnit && boundary === Boundary.Both){
                    if(forward ? bound === Boundary.End :
                                              bound === Boundary.Start){
                        count++;
                    }
                }else{ count++; }
            }
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
