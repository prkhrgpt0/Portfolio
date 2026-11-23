const show = (id, value) => {
  document.getElementById(id).textContent = String(value);
};

// 1. Check the value
show("before", navigator.webdriver);

// 2. Try to delete it
let result;
try {
  result = delete navigator.webdriver;
} catch (e) {
  result = "Error: " + e.message;
}
show("deleted", result);

// 3. Check again
show("after", navigator.webdriver);
