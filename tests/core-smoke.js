const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = path.resolve(__dirname, "..");
global.window = {};

for (const file of ["conversation-utils.js", "settings.js", "selection.js", "tree-ops.js", "branch-ops.js", "drag-manager.js"]) {
  const source = fs.readFileSync(path.join(root, "src", file), "utf8");
  vm.runInThisContext(source, { filename: file });
}

const Conversation = globalThis.ChatGPTExplorerConversation;
const Settings = globalThis.ChatGPTExplorerSettings;
const SelectionManager = window.ChatGPTExplorerSelectionManager;
const TreeOps = window.ChatGPTExplorerTreeOps;
const BranchOps = globalThis.ChatGPTExplorerBranchOps;
const DragManager = window.ChatGPTExplorerDragManager;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function evt({ ctrl = false, shift = false } = {}) {
  return { ctrlKey: ctrl, metaKey: false, shiftKey: shift };
}

const projectUrl = "https://chatgpt.com/g/g-p-project-name/c/abc123";
assert(Conversation.isProjectConversationUrl(projectUrl), "Project conversation URL not recognized");
assert(
  Conversation.normalizeCapturedTitle("Maths | Geometry sequence - ChatGPT", projectUrl) === "Geometry sequence",
  "Project title prefix with pipe was not removed"
);
assert(
  Conversation.normalizeCapturedTitle("A | B - ChatGPT", "https://chatgpt.com/c/abc123") === "A | B",
  "Non-project pipe title should be preserved"
);
assert(
  Conversation.sameConversationUrl("https://chatgpt.com/c/abc123", projectUrl),
  "Conversation identity should ignore project URL wrapper"
);
assert(Conversation.looksLikeBranchAction("Branch in new chat"), "English branch action not recognized");
assert(Conversation.looksLikeBranchAction("Créer une branche dans un nouveau chat"), "French branch action not recognized");
assert(Conversation.looksLikeBranchParentLabel("Branched from Original chat"), "Branch parent marker not recognized");
assert(Conversation.stripBranchParentLabel("Branched from Original chat") === "Original chat", "Branch parent label stripping failed");

const defaults = Settings.normalizeSettings(null);
assert(defaults.quickAddEnabled === false, "Quick Add should default false");
assert(defaults.branchTrackingEnabled === false, "Branch tracking should default false");
assert(defaults.viewMode === "explorer", "Explorer should be default view");
assert(Array.isArray(defaults.expandedFolderIds) && defaults.expandedFolderIds.length === 0, "Folders should default collapsed");
const normalizedSettings = Settings.normalizeSettings({
  quickAddEnabled: true,
  branchTrackingEnabled: true,
  quickAddParentId: "folder-1",
  expandedFolderIds: ["a", "a", "b", null],
  viewMode: "families"
});
assert(normalizedSettings.branchTrackingEnabled, "Branch tracking setting normalization failed");
assert(normalizedSettings.expandedFolderIds.join(",") === "a,b", "Expanded folder IDs normalization failed");
assert(normalizedSettings.viewMode === "families", "Families view setting normalization failed");

const selection = new SelectionManager();
const visible = ["a", "b", "c", "d", "e"];
selection.handleClick("b", evt(), visible);
selection.handleClick("d", evt({ shift: true }), visible);
assert(JSON.stringify(selection.values()) === JSON.stringify(["b", "c", "d"]), "Shift range failed");
selection.handleClick("a", evt({ ctrl: true }), visible);
assert(selection.has("a") && selection.size() === 4, "Ctrl additive selection failed");

const drag = new DragManager();
drag.arm(7, 100, 100);
assert(!drag.movedPastThreshold(103, 104), "Drag threshold triggered too early");
assert(drag.movedPastThreshold(106, 101), "Drag threshold failed to trigger");

const state = {
  schemaVersion: 1,
  nodes: [
    { id: "folderA", type: "folder", name: "A", parentId: null, sortIndex: 0 },
    { id: "folderB", type: "folder", name: "B", parentId: null, sortIndex: 1 },
    { id: "root", type: "chat", name: "Root", parentId: "folderA", url: "https://chatgpt.com/c/root", sortIndex: 0 },
    { id: "child", type: "chat", name: "Child", parentId: "folderA", url: "https://chatgpt.com/c/child", sortIndex: 1, branchParentConversationId: "root", branchRootConversationId: "root", branchDetectedAt: "2026-09-21T10:00:00Z" },
    { id: "grand", type: "chat", name: "Grand", parentId: "folderB", url: "https://chatgpt.com/c/grand", sortIndex: 0, branchParentConversationId: "child", branchRootConversationId: "root", branchDetectedAt: "2026-09-21T11:00:00Z" },
    { id: "standalone", type: "chat", name: "Standalone", parentId: null, url: "https://chatgpt.com/c/standalone", sortIndex: 2 }
  ]
};

assert(BranchOps.rootConversationIdFor(state, "grand", Conversation) === "root", "Family root resolution failed");
const roots = BranchOps.familyRoots(state, Conversation);
assert(roots.length === 1 && roots[0].id === "root", "Family roots filtering failed");
assert(BranchOps.familyChildren(state, "root", Conversation)[0].id === "child", "Family child lookup failed");
assert(BranchOps.hasFamilyRelation(state, state.nodes.find((n) => n.id === "root"), Conversation), "Root family relation not recognized");
assert(!BranchOps.hasFamilyRelation(state, state.nodes.find((n) => n.id === "standalone"), Conversation), "Standalone chat incorrectly marked as family");

assert(TreeOps.canMove(state, ["child"], "folderB"), "Valid chat move rejected");
const moveResult = TreeOps.moveNodes(state, ["child"], "folderB", "2026-01-01T00:00:00Z");
assert(moveResult.movedIds.length === 1 && TreeOps.nodeById(state, "child").parentId === "folderB", "Chat move failed");
assert(TreeOps.nodeById(state, "child").branchParentConversationId === "root", "Folder move must not change branch parent");

console.log("CORE_SMOKE_OK");
