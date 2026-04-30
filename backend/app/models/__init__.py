# Import all models here so SQLAlchemy registers them before create_tables() runs.
from app.models.activity import Activity  # noqa: F401
from app.models.lead import Lead  # noqa: F401
from app.models.lead_activity import LeadActivity  # noqa: F401
from app.models.followup_task import FollowUpTask  # noqa: F401
from app.models.proposal import Proposal  # noqa: F401
from app.models.content import ContentPost  # noqa: F401
from app.models.campaign import MarketingCampaign  # noqa: F401
from app.models.email_campaign import EmailCampaign  # noqa: F401
from app.models.seo_project import SEOProject  # noqa: F401
from app.models.website import Website, WebsitePage, WebsiteRequirements, WebsiteRevision  # noqa: F401
from app.models.whatsapp import WhatsAppContact, WhatsAppMessage, WhatsAppTemplate, WhatsAppBroadcast  # noqa: F401
from app.models.kpi import KPISnapshot  # noqa: F401
from app.models.invoice import Invoice  # noqa: F401
from app.models.agent import AgentRun, AgentAction  # noqa: F401
from app.models.settings import AgencySettings, TeamMember  # noqa: F401
