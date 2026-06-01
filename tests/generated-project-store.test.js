const test = require("node:test");
const assert = require("node:assert/strict");
const { createGeneratedProjectStore, createMemoryStorage } = require("../lib/generated-project-store");

function sampleProject(overrides = {}) {
  return {
    id: overrides.id || "project-1",
    sourceIdea: "我想做一个帮独立开发者找项目方向的小工具",
    answers: [],
    title: overrides.title || "独立开发者灵感雷达",
    conclusion: "建议做，但需要从细分场景切入。",
    domesticProducts: [],
    globalProducts: [],
    entryDirection: "先做轻量项目方向评估工具。",
    advantages: ["适合小团队快速验证"],
    risks: [{ description: "竞品强", source: "同类 AI 工具已有成熟产品" }],
    suggestions: ["先访谈 5 个独立开发者"],
    createdAt: overrides.createdAt || "2026-06-01T00:00:00.000Z",
    favoriteStatus: false,
    compareStatus: false
  };
}

test("saveProject stores projects newest first", () => {
  const store = createGeneratedProjectStore(createMemoryStorage());

  store.saveProject(sampleProject({ id: "old", createdAt: "2026-06-01T00:00:00.000Z" }));
  store.saveProject(sampleProject({ id: "new", createdAt: "2026-06-01T01:00:00.000Z" }));

  assert.deepEqual(
    store.getProjects().map((project) => project.id),
    ["new", "old"]
  );
});

test("saveProject replaces an existing project with the same id", () => {
  const store = createGeneratedProjectStore(createMemoryStorage());

  store.saveProject(sampleProject({ id: "project-1", title: "旧标题" }));
  store.saveProject(sampleProject({ id: "project-1", title: "新标题" }));

  const projects = store.getProjects();
  assert.equal(projects.length, 1);
  assert.equal(projects[0].title, "新标题");
});

test("toggleFavorite flips favoriteStatus", () => {
  const store = createGeneratedProjectStore(createMemoryStorage());
  store.saveProject(sampleProject({ id: "project-1" }));

  assert.equal(store.toggleFavorite("project-1").favoriteStatus, true);
  assert.equal(store.toggleFavorite("project-1").favoriteStatus, false);
});

test("toggleCompare flips compareStatus", () => {
  const store = createGeneratedProjectStore(createMemoryStorage());
  store.saveProject(sampleProject({ id: "project-1" }));

  assert.equal(store.toggleCompare("project-1").compareStatus, true);
  assert.equal(store.toggleCompare("project-1").compareStatus, false);
});
