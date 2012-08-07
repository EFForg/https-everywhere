const CC = Components.classes;
const CI = Components.interfaces;
VERB=1;
DBUG=2;
INFO=3;
NOTE=4;
WARN=5;

https_everywhere = CC["@eff.org/https-everywhere;1"].getService(Components.interfaces.nsISupports).wrappedJSObject;
o_httpsprefs = https_everywhere.get_prefs();

const id_prefix = "he_enable";
const pref_prefix = "extensions.https_everywhere.";
const baseSite = "https://gitweb.torproject.org/https-everywhere.git/blob_plain/";
const directory = "/src/chrome/content/rules/";
const headString = "HEAD";

window.onresize = function() {
	var textBox = document.getElementById("source-text");
	textBox.width = window.innerWidth - 50;
	textBox.height = window.innerHeight - 100;
}

function sourceViewInit() {
	if("arguments" in window && window.arguments.length > 0) {
		var filename = window.arguments[0].xmlName;
		var id = window.arguments[0].GITCommitID; //GIT commit ID
		var URL = getURL(filename, id);
		var source = getSource(URL, filename, false);
	} else {
		alert("Invalid window arguments."); //This should never happen
	}
}

function getURL(filename, GITCommitID) {
	return baseSite + GITCommitID + ":" + directory + filename;
}

function getSource(URL, filename, useHEAD) {
	setFilenameText(filename);
	setPathText(URL);
	
	var req = CC["@mozilla.org/xmlextras/xmlhttprequest;1"]
	.createInstance(CI.nsIXMLHttpRequest);
	req.open("GET", URL);
	
	//Clear User-Agent
	req.setRequestHeader("User-Agent", "");
	
	req.onreadystatechange = function(params) {
		if (req.readyState == 4) {
			if (req.status == 200) {
				setSourceText(req.responseText);
			} else if (!useHEAD) {
				//Since we pull the git commit id from .git/refs/HEAD, this project's id might be newer
				//than the latest commit in the remote git repository. Therefore, use the HEAD version.
				var URL = getURL(filename, headString);
				getSource(URL, filename, true);
			} else {
				downloadFailed();
			}
		}
	}
	
	req.send();
}
	
function downloadFailed() {
	document.getElementById("source-text").hidden = true;
	document.getElementById("failure-label").hidden = false;
	
}

function setSourceText(text) {
	var textBox = document.getElementById("source-text");
	textBox.value = text;
}

function setFilenameText(text) {
	var textLabel = document.getElementById("filename-text");
	textLabel.value = text;
}

function setPathText(text) {
	var textLabel = document.getElementById("path-text");
	textLabel.value = text;
}