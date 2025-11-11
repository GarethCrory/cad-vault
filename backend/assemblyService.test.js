import assert from "assert";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

process.env.ASSEMBLY_STORE_PATH = path.join(os.tmpdir(), `assemblies-test-${Date.now()}.json`);

const {
  linkAssembly,
  listAssembly,
  updateAssemblyQty,
  unlinkAssembly,
  expandAssemblyTree,
  resetAssemblyStore
} = await import("./assemblyService.js");

async function run() {
  await resetAssemblyStore();
  const ctx = { projectNumber: "P001", projectName: "TestProject" };

  await linkAssembly({ ...ctx, parent: { typePrefix: "A", partNumber: "001" }, child: { typePrefix: "B", partNumber: "002" }, qty: 2 });
  await linkAssembly({ ...ctx, parent: { typePrefix: "B", partNumber: "002" }, child: { typePrefix: "C", partNumber: "003" }, qty: 3 });

  // allow loose payloads that only provide composite codes
  await linkAssembly({ ...ctx, parent: { code: "A-001" }, child: { code: "P002" }, qty: 1 });

  let list = await listAssembly({ ...ctx, typePrefix: "A", partNumber: "001" });
  assert.strictEqual(list.children.length, 2);
  const qtyByCode = new Map(list.children.map((child) => [`${child.typePrefix}${child.partNumber}`, child.qty]));
  assert.strictEqual(qtyByCode.get("B002"), 2);
  assert.strictEqual(qtyByCode.get("P002"), 1);

  await linkAssembly({ ...ctx, parent: { typePrefix: "A", partNumber: "001" }, child: { typePrefix: "B", partNumber: "002" }, qty: 5 });
  list = await listAssembly({ ...ctx, typePrefix: "A", partNumber: "001" });
  assert.strictEqual(list.children[0].qty, 5);

  await updateAssemblyQty({ ...ctx, parent: { typePrefix: "A", partNumber: "001" }, child: { typePrefix: "B", partNumber: "002" }, qty: 4 });
  list = await listAssembly({ ...ctx, typePrefix: "A", partNumber: "001" });
  assert.strictEqual(list.children[0].qty, 4);

  const tree = await expandAssemblyTree(ctx.projectNumber, ctx.projectName, { typePrefix: "A", partNumber: "001" });
  const cNode = tree.find((node) => node.typePrefix === "C");
  assert.ok(cNode);
  assert.strictEqual(cNode.qty, 12);

  let circularError = null;
  try {
    await linkAssembly({ ...ctx, parent: { typePrefix: "C", partNumber: "003" }, child: { typePrefix: "A", partNumber: "001" }, qty: 1 });
  } catch (err) {
    circularError = err;
  }
  assert.ok(circularError);
  assert.strictEqual(circularError.message, "Circular link");

  await unlinkAssembly({ ...ctx, parent: { typePrefix: "A", partNumber: "001" }, child: { typePrefix: "B", partNumber: "002" } });
  await unlinkAssembly({ ...ctx, parent: { typePrefix: "A", partNumber: "001" }, child: { code: "P002" } });
  list = await listAssembly({ ...ctx, typePrefix: "A", partNumber: "001" });
  assert.strictEqual(list.children.length, 0);

  console.log("assemblyService tests passed");
}

run();
