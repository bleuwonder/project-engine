function generateGreeting(name, isShouting) {
  const safeName = typeof name === "string" ? name.trim() : "";

  if (!safeName) {
    return "Hello!";
  }

  const greeting = `Hello, ${safeName}!`;
  return isShouting ? greeting.toUpperCase() : greeting;
}

module.exports = {
  generateGreeting,
};