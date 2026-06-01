const {
  createGeneratedProjectStore,
} = require("../../lib/generated-project-store");
const ToastModule = require("tdesign-miniprogram/toast/index");

const showToast = ToastModule.default || ToastModule.showToast || ToastModule;

Page({
  data: {
    projects: [],
    selectedProject: null,
    detailVisible: false,
  },

  onLoad() {
    this.projectStore = createGeneratedProjectStore();
    this.refreshProjects();
  },

  onShow() {
    if (this.projectStore) {
      this.refreshProjects();
    }
  },

  refreshProjects() {
    this.setData({
      projects: this.projectStore.getProjects(),
    });
  },

  onToggleFavorite(event) {
    const project = this.projectStore.toggleFavorite(
      event.currentTarget.dataset.id,
    );

    if (project) {
      this.refreshProjects();
    }
  },

  onToggleCompare(event) {
    const project = this.projectStore.toggleCompare(
      event.currentTarget.dataset.id,
    );

    if (project) {
      this.refreshProjects();
    }
  },

  onGeneratePrd() {
    showToast({
      context: this,
      selector: "#t-toast",
      message: "PRD 生成功能后续接入",
      theme: "warning",
    });
  },

  onOpenDetail(event) {
    const projectId = event.currentTarget.dataset.id;
    const selectedProject = this.data.projects.find(
      (project) => project.id === projectId,
    );

    this.setData({
      selectedProject,
      detailVisible: Boolean(selectedProject),
    });
  },

  onCloseDetail() {
    this.setData({
      selectedProject: null,
      detailVisible: false,
    });
  },

  onDetailVisibleChange(event) {
    this.setData({
      detailVisible: event.detail.visible,
    });
  },

  noop() {},
});
