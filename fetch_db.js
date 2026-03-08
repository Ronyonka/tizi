const projectId = "tizi-a51ed";

async function run() {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/logs`);
  const data = await res.json();
  console.log("LOGS:");
  data.documents.slice(0, 3).forEach(d => {
    console.log(d.name);
    console.log(JSON.stringify(d.fields, null, 2));
  });

  const res2 = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/exercises`);
  const data2 = await res2.json();
  console.log("EXERCISES:");
  data2.documents.slice(0, 3).forEach(d => {
    console.log(d.name);
    console.log(JSON.stringify(d.fields, null, 2));
  });
}
run();
