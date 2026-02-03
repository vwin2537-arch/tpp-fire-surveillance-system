/**
 * ระบบรายงานจุดเฝ้าระวังไฟป่า (Drive + Auto-Sheets Hybrid)
 * พัฒนาสำหรับ: อุทยานแห่งชาติทองผาภูมิ
 * 
 * วิธีใช้:
 * 1. นำโค้ดนี้ไปวางใน Google Apps Script (GAS)
 * 2. ตรวจสอบ PARENT_FOLDER_ID ว่าตรงกับของอุทยาน
 * 3. Deploy เป็น Web App
 */

const PARENT_FOLDER_ID = "1DBGRNkA9st-9FiB8vDmTJSoyosERZ8OZ";
const PARK_NAME = "อุทยานแห่งชาติทองผาภูมิ";

function doPost(e) {
    try {
        var data = JSON.parse(e.postData.contents);
        var parentFolder = DriveApp.getFolderById(PARENT_FOLDER_ID);

        // 1. จัดการโฟลเดอร์เก็บรูปภาพ (3 ชั้น: วันที่ > ชื่อจุด > ช่วงเวลา)
        var dateFolder = getOrCreateFolder(parentFolder, data.date);
        var pointFolder = getOrCreateFolder(dateFolder, data.pointName);
        var shiftFolder = getOrCreateFolder(pointFolder, data.shift);

        // 2. บันทึกรูปภาพ
        if (data.images && data.images.length > 0) {
            data.images.forEach(function (base64, index) {
                var contentType = base64.substring(5, base64.indexOf(';'));
                var bytes = Utilities.base64Decode(base64.split(',')[1]);
                var fileName = "IMG_" + data.shift + "_" + Utilities.formatDate(new Date(), "GMT+7", "HHmm") + "_" + (index + 1) + ".jpg";
                var blob = Utilities.newBlob(bytes, contentType, fileName);
                shiftFolder.createFile(blob);
            });
        }

        // 3. จัดการ Google Sheets (ถ้าไม่มีให้สร้างใหม่ในโฟลเดอร์นั้นเลย)
        var sheet = getOrCreateLogSheet(parentFolder);
        var timestamp = new Date();
        sheet.appendRow([
            timestamp,
            data.date,
            data.pointName,
            data.shift,
            data.notes || "",
            shiftFolder.getUrl()
        ]);

        return ContentService.createTextOutput(JSON.stringify({ success: true }))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

// ฟังก์ชันช่วยหาหรือสร้างโฟลเดอร์
function getOrCreateFolder(parent, name) {
    if (!parent || !parent.getFoldersByName) {
        throw new Error("Parent folder is undefined or not a Folder object. Please don't run this function directly.");
    }
    var folders = parent.getFoldersByName(name);
    return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
// ฟังก์ชันสำหรับทดสอบ: กดเลือกฟังก์ชันนี้แล้วกดปุ่ม "เรียกใช้งาน" (Run) ใน GAS Editor
// +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
function testConnection() {
    try {
        var folder = DriveApp.getFolderById(PARENT_FOLDER_ID);
        Logger.log("✅ เชื่อมต่อสำเร็จ! ชื่อโฟลเดอร์คือ: " + folder.getName());

        var testSubFolder = getOrCreateFolder(folder, "TEST_CONNECTION");
        Logger.log("✅ ทดสอบสร้าง/เข้าถึงโฟลเดอร์ย่อยสำเร็จ: " + testSubFolder.getName());

        var sheet = getOrCreateLogSheet(folder);
        Logger.log("✅ ทดสอบเข้าถึง Sheet สำเร็จ: " + sheet.getName());

        Logger.log("🚀 ทุกอย่างพร้อมใช้งาน! อย่าลืม Deploy เป็น Web App (New Deployment)");
    } catch (e) {
        Logger.log("❌ เกิดข้อผิดพลาด: " + e.toString());
        if (e.toString().includes("Access denied")) {
            Logger.log("💡 คำแนะนำ: ตรวจสอบว่าคุณเป็นเจ้าของโฟลเดอร์ หรือแชร์ให้ Email ที่ใช้รัน GAS แล้วหรือยัง");
        }
    }
}

// ฟังก์ชันหัวใจสำคัญ: หา Sheet ถ้าไม่มีให้สร้างพร้อม Header
function getOrCreateLogSheet(parentFolder) {
    var fileName = "รายงานจุดเฝ้าระวัง_" + PARK_NAME;
    var files = parentFolder.getFilesByName(fileName);
    var ss;

    if (files.hasNext()) {
        ss = SpreadsheetApp.open(files.next());
    } else {
        // สร้างไฟล์ใหม่ใน Folder นั้นเลย
        ss = SpreadsheetApp.create(fileName);
        var ssFile = DriveApp.getFileById(ss.getId());
        parentFolder.addFile(ssFile);
        DriveApp.getRootFolder().removeFile(ssFile); // ย้ายออกจาก Root ไปยัง Folder ที่กำหนด

        var sheet = ss.getSheets()[0];
        sheet.appendRow(["วันที่-เวลาที่ส่ง", "วันที่รายงาน", "ชื่อจุดเฝ้าระวัง", "ช่วงเวลา", "หมายเหตุ/ข้อสังเกต", "ลิงก์โฟลเดอร์รูปภาพ"]);
        sheet.setFrozenRows(1);
        sheet.getRange("A1:F1").setBackground("#10b981").setFontColor("white").setFontWeight("bold");
    }
    return ss.getSheets()[0];
}

function doGet(e) {
    try {
        var parentFolder = DriveApp.getFolderById(PARENT_FOLDER_ID);
        var targetDate = e.parameter.date || Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
        var results = [];

        var dateFolders = parentFolder.getFoldersByName(targetDate);
        if (dateFolders.hasNext()) {
            var dateFolder = dateFolders.next();
            var pointFolders = dateFolder.getFolders();
            while (pointFolders.hasNext()) {
                var pFolder = pointFolders.next();
                var sFolders = pFolder.getFolders();
                while (sFolders.hasNext()) {
                    results.push({
                        pointName: pFolder.getName().replace(/(\d+)/, (match) => match.padStart(2, '0')),
                        shift: sFolders.next().getName()
                    });
                }
            }
        }
        return ContentService.createTextOutput(JSON.stringify(results)).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
        return ContentService.createTextOutput(JSON.stringify([])).setMimeType(ContentService.MimeType.JSON);
    }
}
