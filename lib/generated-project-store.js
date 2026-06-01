const STORAGE_KEY = "generatedProjects";

function createMemoryStorage(initialData) {
  const data = Object.assign({}, initialData);

  return {
    getStorageSync(key) {
      return data[key];
    },
    setStorageSync(key, value) {
      data[key] = value;
    }
  };
}

function resolveStorage(storage) {
  if (storage) {
    return storage;
  }

  if (typeof wx !== "undefined" && wx.getStorageSync && wx.setStorageSync) {
    return wx;
  }

  return createMemoryStorage();
}

function normalizeProjects(value) {
  return Array.isArray(value) ? value : [];
}

function sortNewestFirst(projects) {
  return projects.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function createGeneratedProjectStore(storage) {
  const resolvedStorage = resolveStorage(storage);

  function getProjects() {
    return sortNewestFirst(normalizeProjects(resolvedStorage.getStorageSync(STORAGE_KEY)));
  }

  function writeProjects(projects) {
    resolvedStorage.setStorageSync(STORAGE_KEY, sortNewestFirst(projects));
  }

  function saveProject(project) {
    const remaining = getProjects().filter((item) => item.id !== project.id);
    const nextProject = Object.assign(
      {
        favoriteStatus: false,
        compareStatus: false
      },
      project
    );
    writeProjects([nextProject].concat(remaining));
    return nextProject;
  }

  function updateProject(projectId, updater) {
    const projects = getProjects();
    const index = projects.findIndex((project) => project.id === projectId);

    if (index === -1) {
      return null;
    }

    const nextProject = updater(projects[index]);
    const nextProjects = projects.slice();
    nextProjects[index] = nextProject;
    writeProjects(nextProjects);
    return nextProject;
  }

  function toggleFavorite(projectId) {
    return updateProject(projectId, (project) =>
      Object.assign({}, project, { favoriteStatus: !project.favoriteStatus })
    );
  }

  function toggleCompare(projectId) {
    return updateProject(projectId, (project) =>
      Object.assign({}, project, { compareStatus: !project.compareStatus })
    );
  }

  return {
    getProjects,
    saveProject,
    toggleFavorite,
    toggleCompare
  };
}

module.exports = {
  STORAGE_KEY,
  createGeneratedProjectStore,
  createMemoryStorage
};
