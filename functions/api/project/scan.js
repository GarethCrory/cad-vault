import { j } from "../../_db.js";
export async function onRequestPost(){
  return j({ parts: [], attachments: [], nextPartNumber: "001" });
}
