(() => {
  "use strict";

  class DragManager {
    constructor() {
      this.draggedIds = [];
      this.activeTarget = null;
      this.activeTargetId = undefined;
      this.ghost = null;
      this.dragging = false;
      this.pointerId = null;
      this.startX = 0;
      this.startY = 0;
      this.threshold = 6;
    }

    arm(pointerId, x, y) {
      this.pointerId = pointerId;
      this.startX = x;
      this.startY = y;
      this.dragging = false;
      this.activeTargetId = undefined;
    }

    movedPastThreshold(x, y) {
      return Math.hypot(x - this.startX, y - this.startY) >= this.threshold;
    }

    begin(ids, x, y) {
      this.draggedIds = [...ids];
      this.dragging = true;
      document.body.classList.add("is-dragging");

      const ghost = document.createElement("div");
      ghost.className = "drag-ghost pointer-ghost";
      ghost.textContent = this.draggedIds.length === 1 ? "Move 1 item" : `Move ${this.draggedIds.length} items`;
      document.body.appendChild(ghost);
      this.ghost = ghost;
      this.moveGhost(x, y);
    }

    moveGhost(x, y) {
      if (!this.ghost) return;
      this.ghost.style.transform = `translate(${x + 12}px, ${y + 12}px)`;
    }

    setTarget(element, valid = true, targetId = undefined) {
      if (this.activeTarget === element && this.activeTargetId === targetId) {
        this.activeTarget?.classList.toggle("drop-target", valid);
        this.activeTarget?.classList.toggle("drop-invalid", !valid);
        return;
      }

      this.clearTarget();
      if (!element) return;
      element.classList.add(valid ? "drop-target" : "drop-invalid");
      this.activeTarget = element;
      this.activeTargetId = targetId;
    }

    clearTarget() {
      if (this.activeTarget) this.activeTarget.classList.remove("drop-target", "drop-invalid");
      this.activeTarget = null;
      this.activeTargetId = undefined;
    }

    removeGhost() {
      if (this.ghost?.isConnected) this.ghost.remove();
      this.ghost = null;
    }

    end() {
      this.clearTarget();
      this.removeGhost();
      this.draggedIds = [];
      this.dragging = false;
      this.pointerId = null;
      document.body.classList.remove("is-dragging");
    }
  }

  window.ChatGPTExplorerDragManager = DragManager;
})();
