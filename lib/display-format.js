function pad(value) {
  return String(value).padStart(2, "0");
}

function formatTimestamp(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    " ",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

function withFormattedCreatedAt(project) {
  return Object.assign({}, project, {
    createdAtText: formatTimestamp(project.createdAt),
  });
}

module.exports = {
  formatTimestamp,
  withFormattedCreatedAt,
};
