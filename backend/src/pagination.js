const MAX_PAGE = 1000;

// Turns a ?page= query value into a page number, falling back to 1 for anything odd.
function parsePage(value) {
  const page = Number(value ?? 1);
  return Number.isInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1;
}

module.exports = { parsePage };
