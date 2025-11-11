export const resolveProjectCode = (ctx) =>
  (ctx?.project?.code ||
   ctx?.project?.projectCode ||
   ctx?.selectedProject?.code ||
   ctx?.selectedProject?.projectCode ||
   "P001");

export const resolvePartNumber = (row) =>
  row?.partNumber ?? row?.part_no ?? row?.part?.number ?? row?.code ?? row?.id ?? "";
