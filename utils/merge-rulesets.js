// Merge all the .xml rulesets into a single "default.rulesets" file -- this
// prevents inodes from wasting disk space, but more importantly, works around
// the fact that zip does not perform well on a pile of small files.

// it is a translation of merge-rulesets.py (without linting, backups, git support, unicode normalisation and --fast option), but it doesn't require Python (only WSH)


var fs = new ActiveXObject("Scripting.FileSystemObject"),
shell = new ActiveXObject("WScript.Shell"),
args = WScript.Arguments,
scriptFullPath = WScript.ScriptFullName,
sourceDir = args[0],
targetFile = args[1];

var msg="";

//console or gui?
var enginefile=WScript.FullName;
var stdout=null;
if(enginefile.toLowerCase().indexOf("cscript.exe")>-1){
	stdout=WScript.StdOut;
}
function getDir(a) {
	return a.substring(0, a.lastIndexOf("\\") || a.lastIndexOf("/"))
}

//checking input

var scriptPath = getDir(WScript.ScriptFullName.toString());
if (!sourceDir) {
	sourceDir = sourceDir || (getDir(scriptPath) + "\\src\\chrome\\content\\rules");
}
var defaultFileName="default.rulesets";
if (!targetFile) {
	targetFile = sourceDir + "\\" + defaultFileName;
}

//shell.Popup(sourceDir, 0, "HTTPS Everywhere Rules Merger",64);
//shell.Popup(targetFile, 0, "HTTPS Everywhere Rules Merger",64);


if(stdout)
	stdout.WriteLine("Merging rulesets... and removing whitespaces and comments...");
var infldr = fs.GetFolder(sourceDir);
var res,fileI;

targetFile=fs.CreateTextFile(targetFile);

function clean_up(rulefile){
	//Remove extra whitespace and comments from a rulesets
	rulefile = rulefile.replace(/<!--[.\n\r\u2028]*?-->/ig,'');
	rulefile = rulefile.replace(/\s+/ig,' ');
	//rulefile = rulefile.replace(/\s*(to=|from=)/ig," $1");
	rulefile = rulefile.replace(/>\s*</, "><");
	//rulefile = rulefile.replace(/<\/ruleset>\s*/ig, "</ruleset>\n");
	rulefile = rulefile.replace(/\s*(\/>|<ruleset)/, "$1");
	return rulefile;
}

var commitId=shell.Environment("Process")("GIT_COMMIT_ID");//lol, it won't work - there is no such variable
if(commitId)
	targetFile.Write('<rulesetlibrary gitcommitid="'+commitId+'">');
else
	targetFile.Write('<rulesetlibrary>');

var fileNameRx=/\.xml$/i;
for(fileI = new Enumerator(infldr.Files); !fileI.atEnd(); fileI.moveNext()){
	if (file = fileI.item()) {
		var name = file.Name;
		if(!fileNameRx.test(name))continue;
		if(stdout)stdout.WriteLine("Processing file "+name+"...");
		var currentFileStream=file.OpenAsTextStream(1);
		var ruleset = currentFileStream.ReadAll();
		currentFileStream.Close();
		delete currentFileStream;
		ruleset = ruleset.replace("<ruleset", '<ruleset f="'+name+'"');
		targetFile.Write(clean_up(ruleset));
	}
}
targetFile.Write("</rulesetlibrary>\n");
targetFile.Close();
delete targetFile;

var currentStageMsg="Merging has been FINISHED!";

if(stdout){
	stdout.WriteLine(currentStageMsg);
}else{
	msg+="\n"+currentStageMsg;
	shell.Popup(msg, 1, "HTTPS Everywhere Rules Merger", 64);
}


/*function normalize(f){
	//OSX and Linux filesystems encode composite characters differently in filenames.
	//We should normalize to NFC: http://unicode.org/reports/tr15/.
	f = unicodedata.normalize('NFC', unicode(f, 'utf-8')).encode('utf-8')
	return f
}*/
