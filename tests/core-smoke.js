const fs = require("fs");
const vm = require("vm");
const path = require("path");

const root = path.resolve(__dirname, "..");
global.window = {};

for (const file of ["selection.js", "tree-ops.js", "drag-manager.js"]) {
  const source = fs.readFileSync(path.join(root, "src", file), "utf8");
  vm.runInThisContext(source, { filename: file });
}

const SelectionManager = window.ChatGPTExplorerSelectionManager;
const TreeOps = window.ChatGPTExplorerTreeOps;
const DragManager = window.ChatGPTExplorerDragManager;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function evt({ ctrl = false, shift = false } = {}) {
  return { ctrlKey: ctrl, metaKey: false, shiftKey: shift };
}

const selection = new SelectionManager();
const visible = ["a", "b", "c", "d", "e"];
selection.handleClick("b", evt(), visible);
selection.handleClick("d", evt({ shift: true }), visible);
assert(JSON.stringify(selection.values()) === JSON.stringify(["b", "c", "d"]), "Shift range failed");
selection.handleClick("a", evt({ ctrl: true }), visible);
assert(selection.has("a") && selection.size() === 4, "Ctrl additive selection failed");
selection.handleClick("c", evt({ ctrl: true }), visible);
assert(!selection.has("c") && selection.size() === 3, "Ctrl toggle off failed");

const drag = new DragManager();
drag.arm(7, 100, 100);
assert(!drag.movedPastThreshold(103, 104), "Drag threshold triggered too early");
assert(drag.movedPastThreshold(106, 101), "Drag threshold failed to trigger");

const state = {
  schemaVersion: 1,
  nodes: [
    { id: "rootA", type: "folder", name: "A", parentId: null, sortIndex: 0 },
    { id: "rootB", type: "folder", name: "B", parentId: null, sortIndex: 1 },
    { id: "sub", type: "folder", name: "Sub", parentId: "rootA", sortIndex: 0 },
    { id: "chat1", type: "chat", name: "Chat 1", parentId: "rootA", sortIndex: 1 },
    { id: "chat2", type: "chat", name: "Chat 2", parentId: "rootA", sortIndex: 2 }
  ]
};

assert(TreeOps.canMove(state, ["chat1", "chat2"], "rootB"), "Valid multi-move rejected");
let result = TreeOps.moveNodes(state, ["chat1", "chat2"], "rootB", "2026-01-01T00:00:00Z");
assert(result.movedIds.length === 2, "Multi-move count wrong");
assert(TreeOps.nodeById(state, "chat1").parentId === "rootB", "chat1 did not move");
assert(TreeOps.nodeById(state, "chat2").parentId === "rootB", "chat2 did not move");
assert(!TreeOps.canMove(state, ["rootA"], "sub"), "Cycle move should be rejected");
assert(TreeOps.topLevelSelection(state, ["rootA", "sub"]).length === 1, "Ancestor compression failed");

result = TreeOps.deleteNodes(state, ["rootA"]);
assert(result.deletedIds.includes("rootA") && result.deletedIds.includes("sub"), "Recursive delete failed");
assert(!TreeOps.nodeById(state, "rootA") && !TreeOps.nodeById(state, "sub"), "Deleted nodes remain");

console.log("CORE_SMOKE_OK");
