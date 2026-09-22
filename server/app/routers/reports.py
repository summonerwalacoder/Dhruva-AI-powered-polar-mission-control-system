import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session

from ..audit import audit
from ..database import get_db
from ..models import Mission, User
from ..security import get_current_user, require
from ..services.reports import daily_report, report_csv_rows, report_to_pdf_bytes

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/daily")
def get_daily_report(mission_id: int, db: Session = Depends(get_db), user: User = Depends(require("reports:use"))):
    mission = db.get(Mission, mission_id)
    if not mission:
        raise HTTPException(404, "Mission not found.")
    report = daily_report(db, mission_id)
    audit(db, user, "generate_report", "mission", mission.mission_id)
    return report


@router.get("/daily/csv")
def export_daily_csv(mission_id: int, db: Session = Depends(get_db), user: User = Depends(require("reports:use"))):
    report = daily_report(db, mission_id)
    if not report:
        raise HTTPException(404, "Mission not found.")
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerows(report_csv_rows(report))
    return Response(content=buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename=dhruva_{report['mission']['code']}_{report['date']}.csv"})


@router.get("/daily/pdf", dependencies=[Depends(require("reports:use"))])
def export_daily_pdf(mission_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    report = daily_report(db, mission_id)
    if not report:
        raise HTTPException(404, "Mission not found.")
    bytes_ = report_to_pdf_bytes(report)
    audit(db, user, "export_pdf", "mission", report["mission"]["code"])
    return Response(content=bytes_, media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename=dhruva_{report['mission']['code']}_{report['date']}.pdf"})