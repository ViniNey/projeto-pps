fetch("http://localhost:3000/admin/register", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer " + localStorage.getItem("token"),
  },
  body: JSON.stringify({
    email: "alessandroteste@admin.com",
    senha: "adminsandrosuper",
  }),
})
  .then((res) => res.json())
  .then((data) => console.log(data));
