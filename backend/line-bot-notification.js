// =============================================================================
// LINE Bot Notification System - แจ้งเตือนจุดที่ยังไม่ส่งรายงานและสรุปรายวัน
// สำหรับระบบเฝ้าระวังไฟป่า อุทยานแห่งชาติเอราวัณ
// =============================================================================

// -----------------------------------------------------------------------------
// ตั้งค่า: ใส่ข้อมูลของท่านตรงนี้
// -----------------------------------------------------------------------------
const CHANNEL_ACCESS_TOKEN = 'jkm/3cMQ/X81XujTHd9HgKbc83QgEeYtBoTl+to2jUNr6Uz/oTTq8sTHJrIZPuniV0aYXJglTceespVYuffxUMvcbnfLy4O2gtbXWlsyc2nYJT1DfZB5QlM0t2a1c5x7Ci/a0k5AtwOd2rZuiPj9qwdB04t89/1O/w1cDnyilFU=';
const GROUP_ID = 'C181762f3539730de0594034db0f508de';
const FOLDER_ID = '1DBGRNkA9st-9FiB8vDmTJSoyosERZ8OZ'; // โฟลเดอร์ที่เก็บรูป

// จำนวนจุดเฝ้าระวังทั้งหมด
const TOTAL_WATCH_POINTS = 15;

// ชื่อกะ
const SHIFTS = {
    MORNING: 'ภาคเช้า',
    AFTERNOON: 'ภาคกลางวัน',
    EVENING: 'ภาคเย็น'
};

// =============================================================================
// ฟังก์ชันหลัก: แจ้งเตือนรายกะ
// =============================================================================

/**
 * แจ้งเตือนภาคเช้า - Trigger เวลา 10:00 น.
 */
function sendMorningNotification() {
    sendShiftNotification(SHIFTS.MORNING);
}

/**
 * แจ้งเตือนภาคกลางวัน - Trigger เวลา 14:00 น.
 */
function sendAfternoonNotification() {
    sendShiftNotification(SHIFTS.AFTERNOON);
}

/**
 * แจ้งเตือนภาคเย็น - Trigger เวลา 18:00 น.
 */
function sendEveningNotification() {
    sendShiftNotification(SHIFTS.EVENING);
}

/**
 * ส่งสรุปรายวัน - Trigger เวลา 19:00 น.
 */
function sendDailySummary() {
    const today = new Date();
    const todayStr = Utilities.formatDate(today, 'Asia/Bangkok', 'yyyy-MM-dd');
    const thaiDate = formatThaiDate(today);

    // ดึงข้อมูลทุกกะ
    const morningData = getShiftReportData(todayStr, SHIFTS.MORNING);
    const afternoonData = getShiftReportData(todayStr, SHIFTS.AFTERNOON);
    const eveningData = getShiftReportData(todayStr, SHIFTS.EVENING);

    const totalSubmitted = morningData.submitted + afternoonData.submitted + eveningData.submitted;
    const totalExpected = TOTAL_WATCH_POINTS * 3;
    const overallPercent = Math.round((totalSubmitted / totalExpected) * 100);

    const flexMessage = createDailySummaryFlexMessage(thaiDate, {
        morning: morningData,
        afternoon: afternoonData,
        evening: eveningData,
        totalSubmitted: totalSubmitted,
        totalExpected: totalExpected,
        overallPercent: overallPercent
    });

    pushLineMessage(flexMessage);
}

// =============================================================================
// ฟังก์ชันช่วย: ส่งแจ้งเตือนรายกะ
// =============================================================================

function sendShiftNotification(shiftName) {
    const today = new Date();
    const todayStr = Utilities.formatDate(today, 'Asia/Bangkok', 'yyyy-MM-dd');
    const thaiDate = formatThaiDate(today);

    const reportData = getShiftReportData(todayStr, shiftName);

    // ถ้าส่งครบทุกจุดแล้ว ส่งข้อความชมเชย
    if (reportData.missingPoints.length === 0) {
        const successMessage = createAllCompleteFlexMessage(shiftName, thaiDate);
        pushLineMessage(successMessage);
    } else {
        // ถ้ายังไม่ครบ ส่งรายชื่อจุดที่ยังไม่ส่ง
        const flexMessage = createMissingPointsFlexMessage(shiftName, thaiDate, reportData);
        pushLineMessage(flexMessage);
    }
}

// =============================================================================
// ฟังก์ชันดึงข้อมูล: จาก Google Drive
// =============================================================================

/**
 * ดึงข้อมูลการส่งรายงานของกะที่ระบุ
 * @param {string} dateStr - วันที่ในรูปแบบ yyyy-MM-dd
 * @param {string} shiftName - ชื่อกะ
 * @returns {Object} - { submitted, missing, missingPoints, percent }
 */
function getShiftReportData(dateStr, shiftName) {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const pointFolders = folder.getFolders();

    const submittedPoints = [];
    const missingPoints = [];

    // สร้าง Map ของจุดเฝ้าระวังทั้งหมด
    const allPoints = [];
    for (let i = 1; i <= TOTAL_WATCH_POINTS; i++) {
        allPoints.push(`จุดเฝ้าระวังที่ ${i}`);
    }

    // เช็คว่าแต่ละจุดส่งหรือยัง
    while (pointFolders.hasNext()) {
        const pointFolder = pointFolders.next();
        const pointName = pointFolder.getName();

        // ข้ามถ้าไม่ใช่โฟลเดอร์จุดเฝ้าระวัง
        if (!pointName.includes('จุดเฝ้าระวังที่')) continue;

        // หาโฟลเดอร์วันที่
        const dateIter = pointFolder.getFoldersByName(dateStr);
        if (dateIter.hasNext()) {
            const dateFolder = dateIter.next();
            // หาโฟลเดอร์กะ
            const shiftIter = dateFolder.getFoldersByName(shiftName);
            if (shiftIter.hasNext()) {
                const shiftFolder = shiftIter.next();
                // เช็คว่ามีไฟล์รูปไหม
                if (shiftFolder.getFiles().hasNext()) {
                    submittedPoints.push(pointName);
                }
            }
        }
    }

    // หาจุดที่ยังไม่ส่ง
    allPoints.forEach(point => {
        if (!submittedPoints.includes(point)) {
            missingPoints.push(point);
        }
    });

    // เรียงลำดับจุดที่ไม่ส่งตามเลข
    missingPoints.sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0]);
        const numB = parseInt(b.match(/\d+/)[0]);
        return numA - numB;
    });

    const submitted = submittedPoints.length;
    const missing = missingPoints.length;
    const percent = Math.round((submitted / TOTAL_WATCH_POINTS) * 100);

    return {
        submitted: submitted,
        missing: missing,
        missingPoints: missingPoints,
        percent: percent
    };
}

// =============================================================================
// Flex Message Templates
// =============================================================================

/**
 * สร้าง Flex Message สำหรับแจ้งจุดที่ยังไม่ส่ง
 */
function createMissingPointsFlexMessage(shiftName, dateStr, data) {
    const emoji = getShiftEmoji(shiftName);
    const color = getProgressColor(data.percent);

    // สร้างรายการจุดที่ไม่ส่ง (แสดงแค่เลขจุด)
    const missingList = data.missingPoints.map(point => {
        const num = point.match(/\d+/)[0];
        return `จุดที่ ${num}`;
    }).join(', ');

    return {
        "type": "flex",
        "altText": `🔔 แจ้งเตือน ${shiftName} - มี ${data.missing} จุดยังไม่ส่ง`,
        "contents": {
            "type": "bubble",
            "size": "giga",
            "header": {
                "type": "box",
                "layout": "vertical",
                "backgroundColor": "#FF5722",
                "paddingAll": "15px",
                "contents": [
                    {
                        "type": "text",
                        "text": `${emoji} แจ้งเตือน ${shiftName}`,
                        "color": "#ffffff",
                        "weight": "bold",
                        "size": "lg"
                    },
                    {
                        "type": "text",
                        "text": `📅 ${dateStr}`,
                        "color": "#ffffff",
                        "size": "sm",
                        "margin": "sm"
                    }
                ]
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "spacing": "md",
                "contents": [
                    {
                        "type": "box",
                        "layout": "horizontal",
                        "contents": [
                            {
                                "type": "text",
                                "text": "✅ ส่งแล้ว",
                                "size": "sm",
                                "color": "#10b981",
                                "weight": "bold",
                                "flex": 1
                            },
                            {
                                "type": "text",
                                "text": `${data.submitted}/${TOTAL_WATCH_POINTS} จุด`,
                                "size": "sm",
                                "color": "#10b981",
                                "align": "end"
                            }
                        ]
                    },
                    {
                        "type": "box",
                        "layout": "horizontal",
                        "contents": [
                            {
                                "type": "text",
                                "text": "❌ ยังไม่ส่ง",
                                "size": "sm",
                                "color": "#ef4444",
                                "weight": "bold",
                                "flex": 1
                            },
                            {
                                "type": "text",
                                "text": `${data.missing} จุด`,
                                "size": "sm",
                                "color": "#ef4444",
                                "align": "end",
                                "weight": "bold"
                            }
                        ]
                    },
                    {
                        "type": "separator",
                        "margin": "lg"
                    },
                    {
                        "type": "text",
                        "text": "📋 จุดที่ยังไม่ส่งรายงาน:",
                        "size": "sm",
                        "color": "#555555",
                        "margin": "lg",
                        "weight": "bold"
                    },
                    {
                        "type": "text",
                        "text": missingList,
                        "size": "sm",
                        "color": "#ef4444",
                        "wrap": true,
                        "margin": "sm"
                    },
                    {
                        "type": "separator",
                        "margin": "lg"
                    },
                    {
                        "type": "box",
                        "layout": "horizontal",
                        "margin": "lg",
                        "contents": [
                            {
                                "type": "text",
                                "text": "ความคืบหน้า",
                                "size": "xs",
                                "color": "#aaaaaa"
                            },
                            {
                                "type": "text",
                                "text": `${data.percent}%`,
                                "size": "xs",
                                "color": color,
                                "align": "end",
                                "weight": "bold"
                            }
                        ]
                    },
                    createProgressBar(data.percent, color, "8px", "4px")
                ]
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": "🔥 ระบบเฝ้าระวังไฟป่า อุทยานแห่งชาติทองผาภูมิ",
                        "size": "xs",
                        "color": "#aaaaaa",
                        "align": "center"
                    }
                ]
            }
        }
    };
}

/**
 * สร้าง Flex Message เมื่อส่งครบทุกจุด
 */
function createAllCompleteFlexMessage(shiftName, dateStr) {
    const emoji = getShiftEmoji(shiftName);

    return {
        "type": "flex",
        "altText": `🎉 ${shiftName} - ส่งครบทุกจุดแล้ว!`,
        "contents": {
            "type": "bubble",
            "size": "kilo",
            "header": {
                "type": "box",
                "layout": "vertical",
                "backgroundColor": "#10b981",
                "paddingAll": "15px",
                "contents": [
                    {
                        "type": "text",
                        "text": `🎉 ยอดเยี่ยม!`,
                        "color": "#ffffff",
                        "weight": "bold",
                        "size": "lg",
                        "align": "center"
                    }
                ]
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "spacing": "md",
                "contents": [
                    {
                        "type": "text",
                        "text": `${emoji} ${shiftName}`,
                        "weight": "bold",
                        "size": "lg",
                        "align": "center"
                    },
                    {
                        "type": "text",
                        "text": `📅 ${dateStr}`,
                        "size": "sm",
                        "color": "#aaaaaa",
                        "align": "center"
                    },
                    {
                        "type": "separator",
                        "margin": "lg"
                    },
                    {
                        "type": "text",
                        "text": `✅ ส่งครบ ${TOTAL_WATCH_POINTS}/${TOTAL_WATCH_POINTS} จุด`,
                        "size": "md",
                        "color": "#10b981",
                        "align": "center",
                        "weight": "bold",
                        "margin": "lg"
                    },
                    {
                        "type": "box",
                        "layout": "vertical",
                        "margin": "lg",
                        "contents": [
                            {
                                "type": "box",
                                "layout": "vertical",
                                "backgroundColor": "#10b981",
                                "height": "8px",
                                "cornerRadius": "4px"
                            }
                        ]
                    }
                ]
            }
        }
    };
}

/**
 * สร้าง Flex Message สรุปรายวัน
 */
function createDailySummaryFlexMessage(dateStr, data) {
    const overallColor = getProgressColor(data.overallPercent);
    const emoji = data.overallPercent === 100 ? '🏆' : (data.overallPercent >= 80 ? '👍' : '⚠️');
    const statusText = data.overallPercent === 100 ? 'ยอดเยี่ยมมาก! ส่งครบทุกจุด' :
        (data.overallPercent >= 80 ? 'ดีมาก! เกือบครบแล้ว' : 'ต้องปรับปรุง');

    return {
        "type": "flex",
        "altText": `📊 สรุปรายวัน ${dateStr} - ${data.overallPercent}%`,
        "contents": {
            "type": "bubble",
            "size": "giga",
            "header": {
                "type": "box",
                "layout": "vertical",
                "backgroundColor": "#1e40af",
                "paddingAll": "15px",
                "contents": [
                    {
                        "type": "text",
                        "text": "📊 สรุปผลการดำเนินงานประจำวัน",
                        "color": "#ffffff",
                        "weight": "bold",
                        "size": "lg"
                    },
                    {
                        "type": "text",
                        "text": `📅 ${dateStr}`,
                        "color": "#ffffff",
                        "size": "sm",
                        "margin": "sm"
                    }
                ]
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "spacing": "md",
                "contents": [
                    // ภาคเช้า
                    createShiftRow("🌅 ภาคเช้า", data.morning),
                    // ภาคกลางวัน
                    createShiftRow("☀️ ภาคกลางวัน", data.afternoon),
                    // ภาคเย็น
                    createShiftRow("🌆 ภาคเย็น", data.evening),
                    {
                        "type": "separator",
                        "margin": "lg"
                    },
                    // สรุปรวม
                    {
                        "type": "box",
                        "layout": "horizontal",
                        "margin": "lg",
                        "contents": [
                            {
                                "type": "text",
                                "text": "📈 สถิติรวมทั้งวัน",
                                "size": "md",
                                "weight": "bold",
                                "flex": 1
                            },
                            {
                                "type": "text",
                                "text": `${data.totalSubmitted}/${data.totalExpected} (${data.overallPercent}%)`,
                                "size": "md",
                                "color": overallColor,
                                "weight": "bold",
                                "align": "end"
                            }
                        ]
                    },
                    createProgressBar(data.overallPercent, overallColor, "10px", "5px"),
                    {
                        "type": "text",
                        "text": `${emoji} ${statusText}`,
                        "size": "md",
                        "color": overallColor,
                        "align": "center",
                        "weight": "bold",
                        "margin": "lg"
                    }
                ]
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": "🔥 ระบบเฝ้าระวังไฟป่า อุทยานแห่งชาติทองผาภูมิ",
                        "size": "xs",
                        "color": "#aaaaaa",
                        "align": "center"
                    }
                ]
            }
        }
    };
}

/**
 * สร้างแถวข้อมูลกะสำหรับสรุปรายวัน
 */
function createShiftRow(label, shiftData) {
    const color = getProgressColor(shiftData.percent);
    return {
        "type": "box",
        "layout": "vertical",
        "margin": "md",
        "contents": [
            {
                "type": "box",
                "layout": "horizontal",
                "contents": [
                    {
                        "type": "text",
                        "text": label,
                        "size": "sm",
                        "weight": "bold",
                        "flex": 1
                    },
                    {
                        "type": "text",
                        "text": `${shiftData.submitted}/${TOTAL_WATCH_POINTS}`,
                        "size": "sm",
                        "color": color,
                        "align": "end"
                    }
                ]
            },
            createProgressBar(shiftData.percent, color, "6px", "3px", "xs")
        ]
    };
}

// =============================================================================
// ฟังก์ชันสร้าง Progress Bar
// =============================================================================

/**
 * สร้าง Progress Bar ที่ใช้งานได้กับ LINE Flex Message
 * @param {number} percent - เปอร์เซ็นต์ (0-100)
 * @param {string} color - สีของ progress bar
 * @param {string} height - ความสูง เช่น "8px"
 * @param {string} radius - ความโค้งมุม เช่น "4px"
 * @param {string} margin - ระยะห่าง เช่น "sm", "md", "lg"
 */
function createProgressBar(percent, color, height, radius, margin) {
    // ใช้ minimum 1% เพื่อหลีกเลี่ยง 0% width ที่ LINE API ไม่รับ
    const safePercent = Math.max(percent, 1);

    const progressBox = {
        "type": "box",
        "layout": "vertical",
        "margin": margin || "sm",
        "contents": [
            {
                "type": "box",
                "layout": "vertical",
                "backgroundColor": "#e0e0e0",
                "height": height,
                "cornerRadius": radius,
                "contents": [
                    {
                        "type": "box",
                        "layout": "vertical",
                        "backgroundColor": percent === 0 ? "#e0e0e0" : color,
                        "width": `${safePercent}%`,
                        "height": height,
                        "cornerRadius": radius,
                        "contents": []
                    }
                ]
            }
        ]
    };

    return progressBox;
}

// =============================================================================
// ฟังก์ชันช่วยเหลือ
// =============================================================================

/**
 * ส่งข้อความไป LINE
 */
function pushLineMessage(flexMessage) {
    const url = 'https://api.line.me/v2/bot/message/push';
    const payload = {
        to: GROUP_ID,
        messages: [flexMessage]
    };

    const options = {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };

    try {
        const response = UrlFetchApp.fetch(url, options);
        Logger.log('LINE API Response: ' + response.getContentText());
    } catch (e) {
        Logger.log('Error sending LINE message: ' + e);
    }
}

/**
 * รับ Emoji ตามกะ
 */
function getShiftEmoji(shiftName) {
    switch (shiftName) {
        case SHIFTS.MORNING: return '🌅';
        case SHIFTS.AFTERNOON: return '☀️';
        case SHIFTS.EVENING: return '🌆';
        default: return '📋';
    }
}

/**
 * รับสีตาม Percent
 */
function getProgressColor(percent) {
    if (percent === 100) return '#10b981';      // เขียว
    if (percent >= 80) return '#f59e0b';        // ส้ม
    if (percent >= 50) return '#f97316';        // ส้มเข้ม
    return '#ef4444';                           // แดง
}

/**
 * แปลงวันที่เป็นภาษาไทย
 */
function formatThaiDate(date) {
    const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];

    const day = date.getDate();
    const month = thaiMonths[date.getMonth()];
    const year = date.getFullYear() + 543; // แปลงเป็น พ.ศ.

    return `${day} ${month} ${year}`;
}

// =============================================================================
// ฟังก์ชันทดสอบ
// =============================================================================

/**
 * ทดสอบส่งแจ้งเตือนภาคเช้า (รันด้วยมือ)
 */
function testMorningNotification() {
    sendMorningNotification();
}

/**
 * ทดสอบส่งสรุปรายวัน (รันด้วยมือ)
 */
/**
 * ทดสอบส่งสรุปรายวัน (รันด้วยมือ)
 */
function testDailySummary() {
    sendDailySummary();
}

// =============================================================================
// API Part: Webhook & Dashboard
// =============================================================================

// =============================================================================
// API Part: Webhook & Dashboard
// =============================================================================

function doPost(e) {
    // รับ Webhook Request แต่ไม่ทำการตอบกลับ (Silent Mode)
    // เพื่อป้องกันไม่ให้บอทรบกวนการสนทนาในกลุ่ม
    // แต่ยังคงสถานะ online สำหรับ LINE Platform

    // (ถ้าต้องการเปิด Debug เพื่อหา ID อีกครั้ง ให้แก้ code ตรงนี้)
    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
}

// =============================================================================
// API Part: สำหรับเชื่อมต่อกับ Dashboard Web App (doGet)
// =============================================================================

/**
 * รองรับ GET Request จากหน้าเว็บ Dashboard
 * คืนค่า JSON สถานะการส่งรายงานของวันที่ระบุ
 */
function doGet(e) {
    try {
        const params = e.parameter;
        // รับค่า date จากพารามิเตอร์ หรือใช้วันปัจจุบัน
        const dateStr = params.date || Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');

        // ดึงข้อมูลรายจุด
        const data = getDashboardDataForWeb(dateStr);

        return ContentService.createTextOutput(JSON.stringify(data))
            .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        const errorResponse = { status: 'error', message: error.toString() };
        return ContentService.createTextOutput(JSON.stringify(errorResponse))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

/**
 * ดึงข้อมูลสถานะรายจุดสำหรับ Dashboard
 * คืนค่า Array ของ { pointName: "ชื่อจุด", shift: "กะ" } เฉพาะที่ส่งแล้ว
 */
/**
 * ดึงข้อมูลสถานะรายจุดสำหรับ Dashboard (พร้อมระบบ Caching 10 นาที)
 * คืนค่า Array ของ { pointName: "ชื่อจุด", shift: "กะ" } เฉพาะที่ส่งแล้ว
 */
function getDashboardDataForWeb(dateStr) {
    // 1. ลองดึงจาก Cache ก่อน
    const cache = CacheService.getScriptCache();
    const cacheKey = 'dashboard_' + dateStr;
    const cached = cache.get(cacheKey);

    if (cached) {
        return JSON.parse(cached);
    }

    // 2. ถ้าไม่มีใน Cache ให้ดึงจาก Drive (ช้าหน่อย)
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const pointFolders = folder.getFolders();
    const result = [];

    while (pointFolders.hasNext()) {
        const pointFolder = pointFolders.next();
        const rawPointName = pointFolder.getName();

        // กรองเฉพาะโฟลเดอร์ที่มีคำว่า "จุดเฝ้าระวังที่"
        if (!rawPointName.includes('จุดเฝ้าระวังที่')) continue;

        // ปรับชื่อให้เป็น format มาตรฐาน (มีเลข 2 หลัก) ให้ตรงกับ Frontend
        // เช่น "จุดเฝ้าระวังที่ 1" -> "จุดเฝ้าระวังที่ 01"
        const pointName = rawPointName.replace(/(\d+)/, (match) => match.padStart(2, '0'));

        const dateFolders = pointFolder.getFoldersByName(dateStr);
        if (dateFolders.hasNext()) {
            const dateFolder = dateFolders.next();

            // ตรวจสอบทั้ง 3 กะ
            [SHIFTS.MORNING, SHIFTS.AFTERNOON, SHIFTS.EVENING].forEach(shift => {
                const shiftFolders = dateFolder.getFoldersByName(shift);
                if (shiftFolders.hasNext()) {
                    const shiftFolder = shiftFolders.next();
                    // ถ้ามีไฟล์ข้างใน ถือว่าส่งแล้ว
                    if (shiftFolder.getFiles().hasNext()) {
                        result.push({
                            pointName: pointName,
                            shift: shift
                        });
                    }
                }
            });
        }
    }

    // 3. บันทึกลง Cache ไว้ใช้งานครั้งหน้า (เก็บไว้ 600 วินาที = 10 นาที)
    cache.put(cacheKey, JSON.stringify(result), 600);

    return result;
}

// =============================================================================
// Debugging Function
// =============================================================================

function debugLineConnection() {
    const url = 'https://api.line.me/v2/bot/message/push';
    const payload = {
        to: GROUP_ID,
        messages: [{
            type: 'text',
            text: '✅ Connection Test: เชื่อมต่อสำเร็จ! (Token และ Group ID ถูกต้อง)'
        }]
    };

    const options = {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };

    try {
        const response = UrlFetchApp.fetch(url, options);
        console.log('Debug Response: ' + response.getContentText());
    } catch (e) {
        console.log('Debug Error: ' + e.toString());
    }
}

function checkBotToken() {
    const url = 'https://api.line.me/v2/bot/info';
    const options = {
        method: 'get',
        headers: {
            'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN
        },
        muteHttpExceptions: true
    };

    try {
        const response = UrlFetchApp.fetch(url, options);
        console.log('Bot Info Response: ' + response.getContentText());
    } catch (e) {
        console.log('Check Token Error: ' + e.toString());
    }
}
