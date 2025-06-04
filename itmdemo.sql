--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Debian 16.9-1.pgdg120+1)
-- Dumped by pg_dump version 17.4

-- Started on 2025-06-03 23:20:11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 244 (class 1259 OID 16894)
-- Name: audit_log; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.audit_log (
    audit_id integer NOT NULL,
    table_name character varying(50) NOT NULL,
    record_id integer NOT NULL,
    action character varying(10) NOT NULL,
    user_id integer,
    username character varying(50),
    changed_data jsonb,
    old_data jsonb,
    new_data jsonb,
    ip_address inet,
    user_agent text,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT audit_log_action_check CHECK (((action)::text = ANY ((ARRAY['INSERT'::character varying, 'UPDATE'::character varying, 'DELETE'::character varying])::text[])))
);


ALTER TABLE public.audit_log OWNER TO itmdemo;

--
-- TOC entry 243 (class 1259 OID 16893)
-- Name: audit_log_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.audit_log_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_log_audit_id_seq OWNER TO itmdemo;

--
-- TOC entry 3826 (class 0 OID 0)
-- Dependencies: 243
-- Name: audit_log_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.audit_log_audit_id_seq OWNED BY public.audit_log.audit_id;


--
-- TOC entry 232 (class 1259 OID 16593)
-- Name: booking; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.booking (
    booking_id integer NOT NULL,
    episode_id integer NOT NULL,
    program_id integer NOT NULL,
    user_id integer NOT NULL,
    booking_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    booking_notes text,
    admin_notes text,
    approved_by_user_id integer,
    approved_ts timestamp without time zone,
    create_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(30),
    updated_by character varying(30),
    CONSTRAINT booking_booking_status_check CHECK (((booking_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.booking OWNER TO itmdemo;

--
-- TOC entry 3827 (class 0 OID 0)
-- Dependencies: 232
-- Name: TABLE booking; Type: COMMENT; Schema: public; Owner: itmdemo
--

COMMENT ON TABLE public.booking IS 'Ice time booking requests and their approval status';


--
-- TOC entry 3828 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN booking.booking_status; Type: COMMENT; Schema: public; Owner: itmdemo
--

COMMENT ON COLUMN public.booking.booking_status IS 'Status of the booking request: pending, approved, rejected, cancelled';


--
-- TOC entry 231 (class 1259 OID 16592)
-- Name: booking_booking_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.booking_booking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.booking_booking_id_seq OWNER TO itmdemo;

--
-- TOC entry 3829 (class 0 OID 0)
-- Dependencies: 231
-- Name: booking_booking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.booking_booking_id_seq OWNED BY public.booking.booking_id;


--
-- TOC entry 228 (class 1259 OID 16547)
-- Name: episode; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.episode (
    episode_id integer NOT NULL,
    event_id integer NOT NULL,
    schedule_id integer,
    program_id integer,
    team_id integer,
    episode_seq_no integer DEFAULT 0,
    episode_start_date_time timestamp without time zone NOT NULL,
    episode_end_date_time timestamp without time zone NOT NULL,
    episode_duration integer,
    episode_title character varying(100) DEFAULT NULL::character varying,
    episode_description text,
    episode_url character varying(200) DEFAULT NULL::character varying,
    episode_color character varying(20) DEFAULT NULL::character varying,
    episode_price numeric(10,2) DEFAULT NULL::numeric,
    update_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    create_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(30) DEFAULT NULL::character varying,
    updated_by character varying(30) DEFAULT NULL::character varying,
    episode_status character varying(20) DEFAULT 'available'::character varying,
    is_recurring boolean DEFAULT false,
    assigned_to_program_id integer,
    CONSTRAINT episode_episode_status_check CHECK (((episode_status)::text = ANY ((ARRAY['available'::character varying, 'assigned'::character varying, 'pending'::character varying, 'booked'::character varying, 'cancelled'::character varying, 'maintenance'::character varying])::text[])))
);


ALTER TABLE public.episode OWNER TO itmdemo;

--
-- TOC entry 3830 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN episode.episode_status; Type: COMMENT; Schema: public; Owner: itmdemo
--

COMMENT ON COLUMN public.episode.episode_status IS 'Current status of the ice time slot';


--
-- TOC entry 3831 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN episode.assigned_to_program_id; Type: COMMENT; Schema: public; Owner: itmdemo
--

COMMENT ON COLUMN public.episode.assigned_to_program_id IS 'Program this slot is assigned to (can request booking)';


--
-- TOC entry 227 (class 1259 OID 16546)
-- Name: episode_episode_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.episode_episode_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.episode_episode_id_seq OWNER TO itmdemo;

--
-- TOC entry 3832 (class 0 OID 0)
-- Dependencies: 227
-- Name: episode_episode_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.episode_episode_id_seq OWNED BY public.episode.episode_id;


--
-- TOC entry 222 (class 1259 OID 16472)
-- Name: event; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.event (
    event_id integer NOT NULL,
    resource_id integer,
    all_day character varying(11) DEFAULT NULL::character varying,
    event_start_date date,
    event_start_time time without time zone,
    event_end_date date,
    event_end_time time without time zone,
    event_start_date_time timestamp without time zone,
    event_end_date_time timestamp without time zone,
    repeat_mode character varying(10) DEFAULT NULL::character varying,
    repeat_ends character varying(30) DEFAULT NULL::character varying,
    num_occurrences integer,
    event_dates text,
    episode_duration integer,
    maintenance_interval integer,
    event_last_date_time timestamp without time zone,
    num_conflicts integer,
    create_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(30) DEFAULT NULL::character varying,
    updated_by character varying(30) DEFAULT NULL::character varying,
    recurrence_pattern_id integer,
    is_recurring_master boolean DEFAULT false,
    parent_event_id integer
);


ALTER TABLE public.event OWNER TO itmdemo;

--
-- TOC entry 221 (class 1259 OID 16471)
-- Name: event_event_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.event_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.event_event_id_seq OWNER TO itmdemo;

--
-- TOC entry 3833 (class 0 OID 0)
-- Dependencies: 221
-- Name: event_event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.event_event_id_seq OWNED BY public.event.event_id;


--
-- TOC entry 218 (class 1259 OID 16400)
-- Name: facility; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.facility (
    facility_id integer NOT NULL,
    org_id integer,
    location_id integer,
    facility_contact_id integer,
    facility_admin_user_id integer,
    facility_name character varying(100) DEFAULT NULL::character varying,
    facility_address_1 character varying(100) DEFAULT NULL::character varying,
    facility_address_2 character varying(100) DEFAULT NULL::character varying,
    facility_city character varying(50) DEFAULT NULL::character varying,
    facility_state character varying(50) DEFAULT NULL::character varying,
    state_id integer,
    facility_postal_code character varying(20) DEFAULT NULL::character varying,
    facility_country character varying(50) DEFAULT NULL::character varying,
    country_id integer,
    facility_time_zone character varying(100) DEFAULT NULL::character varying,
    facility_latitude double precision,
    facility_longitude double precision,
    facility_daily_start_time time without time zone,
    facility_daily_end_time time without time zone,
    facility_default_duration integer,
    facility_default_maint_int integer,
    facility_tax_rate numeric(11,0) DEFAULT NULL::numeric,
    create_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(30) DEFAULT NULL::character varying,
    updated_by character varying(30) DEFAULT NULL::character varying,
    admin_user_id integer,
    business_hours jsonb DEFAULT '{}'::jsonb,
    ice_resurfacing_duration integer DEFAULT 15,
    min_booking_duration integer DEFAULT 60,
    max_booking_duration integer DEFAULT 180,
    advance_booking_days integer DEFAULT 90,
    cancellation_hours integer DEFAULT 24,
    pricing_rules jsonb DEFAULT '{}'::jsonb,
    maintenance_schedule jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE public.facility OWNER TO itmdemo;

--
-- TOC entry 217 (class 1259 OID 16399)
-- Name: facility_facility_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.facility_facility_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.facility_facility_id_seq OWNER TO itmdemo;

--
-- TOC entry 3834 (class 0 OID 0)
-- Dependencies: 217
-- Name: facility_facility_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.facility_facility_id_seq OWNED BY public.facility.facility_id;


--
-- TOC entry 251 (class 1259 OID 16972)
-- Name: facility_holiday; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.facility_holiday (
    holiday_id integer NOT NULL,
    facility_id integer NOT NULL,
    holiday_date date NOT NULL,
    holiday_name character varying(100),
    is_closed boolean DEFAULT true,
    special_hours_open time without time zone,
    special_hours_close time without time zone,
    pricing_multiplier numeric(3,2) DEFAULT 1.5,
    create_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.facility_holiday OWNER TO itmdemo;

--
-- TOC entry 250 (class 1259 OID 16971)
-- Name: facility_holiday_holiday_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.facility_holiday_holiday_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.facility_holiday_holiday_id_seq OWNER TO itmdemo;

--
-- TOC entry 3835 (class 0 OID 0)
-- Dependencies: 250
-- Name: facility_holiday_holiday_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.facility_holiday_holiday_id_seq OWNED BY public.facility_holiday.holiday_id;


--
-- TOC entry 247 (class 1259 OID 16925)
-- Name: facility_hours; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.facility_hours (
    hours_id integer NOT NULL,
    facility_id integer NOT NULL,
    day_of_week integer NOT NULL,
    open_time time without time zone NOT NULL,
    close_time time without time zone NOT NULL,
    is_closed boolean DEFAULT false,
    create_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT facility_hours_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);


ALTER TABLE public.facility_hours OWNER TO itmdemo;

--
-- TOC entry 246 (class 1259 OID 16924)
-- Name: facility_hours_hours_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.facility_hours_hours_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.facility_hours_hours_id_seq OWNER TO itmdemo;

--
-- TOC entry 3836 (class 0 OID 0)
-- Dependencies: 246
-- Name: facility_hours_hours_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.facility_hours_hours_id_seq OWNED BY public.facility_hours.hours_id;


--
-- TOC entry 253 (class 1259 OID 16989)
-- Name: facility_maintenance; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.facility_maintenance (
    maintenance_id integer NOT NULL,
    facility_id integer NOT NULL,
    resource_id integer,
    maintenance_type character varying(50) NOT NULL,
    start_time time without time zone NOT NULL,
    duration_minutes integer NOT NULL,
    days_of_week integer[],
    is_active boolean DEFAULT true,
    created_by character varying(30),
    create_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.facility_maintenance OWNER TO itmdemo;

--
-- TOC entry 252 (class 1259 OID 16988)
-- Name: facility_maintenance_maintenance_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.facility_maintenance_maintenance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.facility_maintenance_maintenance_id_seq OWNER TO itmdemo;

--
-- TOC entry 3837 (class 0 OID 0)
-- Dependencies: 252
-- Name: facility_maintenance_maintenance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.facility_maintenance_maintenance_id_seq OWNED BY public.facility_maintenance.maintenance_id;


--
-- TOC entry 249 (class 1259 OID 16943)
-- Name: facility_pricing; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.facility_pricing (
    pricing_id integer NOT NULL,
    facility_id integer NOT NULL,
    resource_type_id integer,
    program_type_id integer,
    day_of_week integer[],
    start_time time without time zone,
    end_time time without time zone,
    base_price numeric(10,2) NOT NULL,
    prime_time_multiplier numeric(3,2) DEFAULT 1.0,
    weekend_multiplier numeric(3,2) DEFAULT 1.0,
    holiday_multiplier numeric(3,2) DEFAULT 1.5,
    effective_date date NOT NULL,
    expiry_date date,
    created_by character varying(30),
    create_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.facility_pricing OWNER TO itmdemo;

--
-- TOC entry 248 (class 1259 OID 16942)
-- Name: facility_pricing_pricing_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.facility_pricing_pricing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.facility_pricing_pricing_id_seq OWNER TO itmdemo;

--
-- TOC entry 3838 (class 0 OID 0)
-- Dependencies: 248
-- Name: facility_pricing_pricing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.facility_pricing_pricing_id_seq OWNED BY public.facility_pricing.pricing_id;


--
-- TOC entry 257 (class 1259 OID 17182)
-- Name: ice_time_request; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.ice_time_request (
    request_id integer NOT NULL,
    request_number character varying(50) NOT NULL,
    user_id integer NOT NULL,
    program_id integer NOT NULL,
    episode_id integer NOT NULL,
    facility_id integer NOT NULL,
    resource_id integer NOT NULL,
    requested_start_time timestamp without time zone NOT NULL,
    requested_end_time timestamp without time zone NOT NULL,
    request_duration integer NOT NULL,
    episode_price numeric(10,2),
    request_notes text,
    priority character varying(20) DEFAULT 'normal'::character varying,
    request_status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reviewed_at timestamp without time zone,
    reviewed_by_user_id integer,
    admin_notes text,
    expires_at timestamp without time zone,
    created_by character varying(30),
    updated_by character varying(30),
    create_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ice_time_request_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[]))),
    CONSTRAINT ice_time_request_request_status_check CHECK (((request_status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'cancelled'::character varying, 'expired'::character varying, 'confirmed'::character varying])::text[])))
);


ALTER TABLE public.ice_time_request OWNER TO itmdemo;

--
-- TOC entry 3839 (class 0 OID 0)
-- Dependencies: 257
-- Name: TABLE ice_time_request; Type: COMMENT; Schema: public; Owner: itmdemo
--

COMMENT ON TABLE public.ice_time_request IS 'Ice time requests from program schedulers to arena administrators';


--
-- TOC entry 3840 (class 0 OID 0)
-- Dependencies: 257
-- Name: COLUMN ice_time_request.request_number; Type: COMMENT; Schema: public; Owner: itmdemo
--

COMMENT ON COLUMN public.ice_time_request.request_number IS 'Human-readable request identifier (e.g., REQ-2025-001234)';


--
-- TOC entry 3841 (class 0 OID 0)
-- Dependencies: 257
-- Name: COLUMN ice_time_request.expires_at; Type: COMMENT; Schema: public; Owner: itmdemo
--

COMMENT ON COLUMN public.ice_time_request.expires_at IS 'When pending requests automatically expire';


--
-- TOC entry 256 (class 1259 OID 17181)
-- Name: ice_time_request_request_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.ice_time_request_request_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ice_time_request_request_id_seq OWNER TO itmdemo;

--
-- TOC entry 3842 (class 0 OID 0)
-- Dependencies: 256
-- Name: ice_time_request_request_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.ice_time_request_request_id_seq OWNED BY public.ice_time_request.request_id;


--
-- TOC entry 236 (class 1259 OID 16620)
-- Name: notification; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.notification (
    notification_id integer NOT NULL,
    user_id integer NOT NULL,
    notification_type character varying(50) NOT NULL,
    notification_title character varying(200),
    notification_message text,
    related_booking_id integer,
    related_episode_id integer,
    is_read boolean DEFAULT false,
    read_ts timestamp without time zone,
    create_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.notification OWNER TO itmdemo;

--
-- TOC entry 3843 (class 0 OID 0)
-- Dependencies: 236
-- Name: TABLE notification; Type: COMMENT; Schema: public; Owner: itmdemo
--

COMMENT ON TABLE public.notification IS 'System notifications for users about booking updates';


--
-- TOC entry 235 (class 1259 OID 16619)
-- Name: notification_notification_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.notification_notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notification_notification_id_seq OWNER TO itmdemo;

--
-- TOC entry 3844 (class 0 OID 0)
-- Dependencies: 235
-- Name: notification_notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.notification_notification_id_seq OWNED BY public.notification.notification_id;


--
-- TOC entry 226 (class 1259 OID 16526)
-- Name: program; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.program (
    program_id integer NOT NULL,
    program_admin_user_id integer,
    program_type_id integer,
    program_name character varying(100) DEFAULT NULL::character varying,
    program_color character varying(20) DEFAULT NULL::character varying,
    create_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(30) DEFAULT NULL::character varying,
    updated_by character varying(30) DEFAULT NULL::character varying,
    scheduler_user_id integer
);


ALTER TABLE public.program OWNER TO itmdemo;

--
-- TOC entry 225 (class 1259 OID 16525)
-- Name: program_program_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.program_program_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.program_program_id_seq OWNER TO itmdemo;

--
-- TOC entry 3845 (class 0 OID 0)
-- Dependencies: 225
-- Name: program_program_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.program_program_id_seq OWNED BY public.program.program_id;


--
-- TOC entry 224 (class 1259 OID 16509)
-- Name: program_type; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.program_type (
    program_type_id integer NOT NULL,
    program_type_name character varying(100) DEFAULT NULL::character varying,
    program_type_desc text,
    create_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(30) DEFAULT NULL::character varying,
    updated_by character varying(30) DEFAULT NULL::character varying
);


ALTER TABLE public.program_type OWNER TO itmdemo;

--
-- TOC entry 223 (class 1259 OID 16508)
-- Name: program_type_program_type_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.program_type_program_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.program_type_program_type_id_seq OWNER TO itmdemo;

--
-- TOC entry 3846 (class 0 OID 0)
-- Dependencies: 223
-- Name: program_type_program_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.program_type_program_type_id_seq OWNED BY public.program_type.program_type_id;


--
-- TOC entry 259 (class 1259 OID 17230)
-- Name: realtime_notification; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.realtime_notification (
    notification_id integer NOT NULL,
    target_type character varying(20) NOT NULL,
    target_id integer,
    event_type character varying(50) NOT NULL,
    event_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    title character varying(200),
    message text,
    websocket_rooms character varying(500)[],
    sent_at timestamp without time zone,
    is_delivered boolean DEFAULT false,
    is_persistent boolean DEFAULT true,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id integer,
    CONSTRAINT realtime_notification_target_type_check CHECK (((target_type)::text = ANY ((ARRAY['user'::character varying, 'facility'::character varying, 'program'::character varying, 'global'::character varying])::text[])))
);


ALTER TABLE public.realtime_notification OWNER TO itmdemo;

--
-- TOC entry 3847 (class 0 OID 0)
-- Dependencies: 259
-- Name: TABLE realtime_notification; Type: COMMENT; Schema: public; Owner: itmdemo
--

COMMENT ON TABLE public.realtime_notification IS 'Queue for real-time WebSocket notifications';


--
-- TOC entry 3848 (class 0 OID 0)
-- Dependencies: 259
-- Name: COLUMN realtime_notification.event_data; Type: COMMENT; Schema: public; Owner: itmdemo
--

COMMENT ON COLUMN public.realtime_notification.event_data IS 'JSON payload for real-time events';


--
-- TOC entry 3849 (class 0 OID 0)
-- Dependencies: 259
-- Name: COLUMN realtime_notification.websocket_rooms; Type: COMMENT; Schema: public; Owner: itmdemo
--

COMMENT ON COLUMN public.realtime_notification.websocket_rooms IS 'Array of Socket.IO room names to broadcast to';


--
-- TOC entry 258 (class 1259 OID 17229)
-- Name: realtime_notification_notification_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.realtime_notification_notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.realtime_notification_notification_id_seq OWNER TO itmdemo;

--
-- TOC entry 3850 (class 0 OID 0)
-- Dependencies: 258
-- Name: realtime_notification_notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.realtime_notification_notification_id_seq OWNED BY public.realtime_notification.notification_id;


--
-- TOC entry 242 (class 1259 OID 16863)
-- Name: recurrence_exception; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.recurrence_exception (
    exception_id integer NOT NULL,
    event_id integer NOT NULL,
    exception_date date NOT NULL,
    reason character varying(255),
    created_by character varying(30),
    create_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.recurrence_exception OWNER TO itmdemo;

--
-- TOC entry 241 (class 1259 OID 16862)
-- Name: recurrence_exception_exception_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.recurrence_exception_exception_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recurrence_exception_exception_id_seq OWNER TO itmdemo;

--
-- TOC entry 3851 (class 0 OID 0)
-- Dependencies: 241
-- Name: recurrence_exception_exception_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.recurrence_exception_exception_id_seq OWNED BY public.recurrence_exception.exception_id;


--
-- TOC entry 240 (class 1259 OID 16845)
-- Name: recurrence_pattern; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.recurrence_pattern (
    pattern_id integer NOT NULL,
    event_id integer NOT NULL,
    recurrence_type character varying(20) NOT NULL,
    interval_value integer DEFAULT 1,
    days_of_week character varying(20)[],
    day_of_month integer,
    week_of_month integer,
    month_of_year integer[],
    max_occurrences integer,
    recurrence_end_date date,
    created_by character varying(30),
    create_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT recurrence_pattern_recurrence_type_check CHECK (((recurrence_type)::text = ANY ((ARRAY['daily'::character varying, 'weekly'::character varying, 'biweekly'::character varying, 'monthly'::character varying, 'custom'::character varying])::text[])))
);


ALTER TABLE public.recurrence_pattern OWNER TO itmdemo;

--
-- TOC entry 239 (class 1259 OID 16844)
-- Name: recurrence_pattern_pattern_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.recurrence_pattern_pattern_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.recurrence_pattern_pattern_id_seq OWNER TO itmdemo;

--
-- TOC entry 3852 (class 0 OID 0)
-- Dependencies: 239
-- Name: recurrence_pattern_pattern_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.recurrence_pattern_pattern_id_seq OWNED BY public.recurrence_pattern.pattern_id;


--
-- TOC entry 263 (class 1259 OID 17306)
-- Name: request_number_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.request_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.request_number_seq OWNER TO itmdemo;

--
-- TOC entry 262 (class 1259 OID 17266)
-- Name: request_status_history; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.request_status_history (
    history_id integer NOT NULL,
    request_id integer NOT NULL,
    old_status character varying(20),
    new_status character varying(20) NOT NULL,
    changed_by_user_id integer,
    change_reason text,
    changed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ip_address inet,
    user_agent text
);


ALTER TABLE public.request_status_history OWNER TO itmdemo;

--
-- TOC entry 3853 (class 0 OID 0)
-- Dependencies: 262
-- Name: TABLE request_status_history; Type: COMMENT; Schema: public; Owner: itmdemo
--

COMMENT ON TABLE public.request_status_history IS 'Audit trail for ice time request status changes';


--
-- TOC entry 261 (class 1259 OID 17265)
-- Name: request_status_history_history_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.request_status_history_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.request_status_history_history_id_seq OWNER TO itmdemo;

--
-- TOC entry 3854 (class 0 OID 0)
-- Dependencies: 261
-- Name: request_status_history_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.request_status_history_history_id_seq OWNED BY public.request_status_history.history_id;


--
-- TOC entry 220 (class 1259 OID 16451)
-- Name: resource; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.resource (
    resource_id integer NOT NULL,
    facility_id integer,
    resource_name character varying(100) DEFAULT NULL::character varying,
    resource_type_id integer,
    resource_status character varying(50) DEFAULT NULL::character varying,
    resource_desc character varying(255) DEFAULT NULL::character varying,
    create_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_ts timestamp without time zone,
    created_by character varying(30) DEFAULT NULL::character varying,
    updated_by character varying(30) DEFAULT NULL::character varying
);


ALTER TABLE public.resource OWNER TO itmdemo;

--
-- TOC entry 219 (class 1259 OID 16450)
-- Name: resource_resource_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.resource_resource_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.resource_resource_id_seq OWNER TO itmdemo;

--
-- TOC entry 3855 (class 0 OID 0)
-- Dependencies: 219
-- Name: resource_resource_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.resource_resource_id_seq OWNED BY public.resource.resource_id;


--
-- TOC entry 234 (class 1259 OID 16609)
-- Name: resource_type; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.resource_type (
    resource_type_id integer NOT NULL,
    resource_type_name character varying(50) NOT NULL,
    resource_type_desc text,
    create_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(30),
    updated_by character varying(30)
);


ALTER TABLE public.resource_type OWNER TO itmdemo;

--
-- TOC entry 233 (class 1259 OID 16608)
-- Name: resource_type_resource_type_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.resource_type_resource_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.resource_type_resource_type_id_seq OWNER TO itmdemo;

--
-- TOC entry 3856 (class 0 OID 0)
-- Dependencies: 233
-- Name: resource_type_resource_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.resource_type_resource_type_id_seq OWNED BY public.resource_type.resource_type_id;


--
-- TOC entry 255 (class 1259 OID 17143)
-- Name: shopping_cart; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.shopping_cart (
    cart_id integer NOT NULL,
    user_id integer NOT NULL,
    program_id integer NOT NULL,
    episode_id integer NOT NULL,
    facility_id integer NOT NULL,
    resource_id integer NOT NULL,
    episode_start_date_time timestamp without time zone NOT NULL,
    episode_end_date_time timestamp without time zone NOT NULL,
    episode_title character varying(100),
    episode_price numeric(10,2),
    resource_name character varying(100),
    facility_name character varying(100),
    added_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    session_id character varying(255),
    notes text,
    priority character varying(20) DEFAULT 'normal'::character varying,
    CONSTRAINT shopping_cart_priority_check CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying])::text[])))
);


ALTER TABLE public.shopping_cart OWNER TO itmdemo;

--
-- TOC entry 3857 (class 0 OID 0)
-- Dependencies: 255
-- Name: TABLE shopping_cart; Type: COMMENT; Schema: public; Owner: itmdemo
--

COMMENT ON TABLE public.shopping_cart IS 'Persistent shopping cart for scheduler ice time requests';


--
-- TOC entry 3858 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN shopping_cart.session_id; Type: COMMENT; Schema: public; Owner: itmdemo
--

COMMENT ON COLUMN public.shopping_cart.session_id IS 'Session that added item - for real-time sync';


--
-- TOC entry 3859 (class 0 OID 0)
-- Dependencies: 255
-- Name: COLUMN shopping_cart.priority; Type: COMMENT; Schema: public; Owner: itmdemo
--

COMMENT ON COLUMN public.shopping_cart.priority IS 'Request priority when submitted';


--
-- TOC entry 254 (class 1259 OID 17142)
-- Name: shopping_cart_cart_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.shopping_cart_cart_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shopping_cart_cart_id_seq OWNER TO itmdemo;

--
-- TOC entry 3860 (class 0 OID 0)
-- Dependencies: 254
-- Name: shopping_cart_cart_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.shopping_cart_cart_id_seq OWNED BY public.shopping_cart.cart_id;


--
-- TOC entry 230 (class 1259 OID 16576)
-- Name: user; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public."user" (
    user_id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    user_type character varying(20) NOT NULL,
    first_name character varying(50),
    last_name character varying(50),
    phone character varying(20),
    is_active boolean DEFAULT true,
    last_login_ts timestamp without time zone,
    create_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    update_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by character varying(30),
    updated_by character varying(30),
    CONSTRAINT user_user_type_check CHECK (((user_type)::text = ANY ((ARRAY['admin'::character varying, 'scheduler'::character varying])::text[])))
);


ALTER TABLE public."user" OWNER TO itmdemo;

--
-- TOC entry 3861 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE "user"; Type: COMMENT; Schema: public; Owner: itmdemo
--

COMMENT ON TABLE public."user" IS 'System users including arena administrators and program schedulers';


--
-- TOC entry 229 (class 1259 OID 16575)
-- Name: user_user_id_seq; Type: SEQUENCE; Schema: public; Owner: itmdemo
--

CREATE SEQUENCE public.user_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_user_id_seq OWNER TO itmdemo;

--
-- TOC entry 3862 (class 0 OID 0)
-- Dependencies: 229
-- Name: user_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: itmdemo
--

ALTER SEQUENCE public.user_user_id_seq OWNED BY public."user".user_id;


--
-- TOC entry 245 (class 1259 OID 16911)
-- Name: v_audit_trail; Type: VIEW; Schema: public; Owner: itmdemo
--

CREATE VIEW public.v_audit_trail AS
 SELECT al.audit_id,
    al.table_name,
    al.record_id,
    al.action,
    al.username,
    (((u.first_name)::text || ' '::text) || (u.last_name)::text) AS full_name,
    al.changed_data,
    al."timestamp",
        CASE
            WHEN ((al.table_name)::text = 'episode'::text) THEN (( SELECT e.episode_title
               FROM public.episode e
              WHERE (e.episode_id = al.record_id)))::text
            WHEN ((al.table_name)::text = 'booking'::text) THEN ('Booking #'::text || al.record_id)
            ELSE (((al.table_name)::text || ' #'::text) || al.record_id)
        END AS record_description
   FROM (public.audit_log al
     LEFT JOIN public."user" u ON ((al.user_id = u.user_id)))
  ORDER BY al."timestamp" DESC;


ALTER VIEW public.v_audit_trail OWNER TO itmdemo;

--
-- TOC entry 238 (class 1259 OID 16711)
-- Name: v_booking_requests; Type: VIEW; Schema: public; Owner: itmdemo
--

CREATE VIEW public.v_booking_requests AS
 SELECT b.booking_id,
    b.booking_status,
    b.booking_notes,
    b.create_ts AS request_date,
    e.episode_id,
    e.episode_start_date_time,
    e.episode_end_date_time,
    e.episode_price,
    r.resource_name AS rink_name,
    p.program_name,
    u.username AS requested_by,
    u.email AS requester_email,
    au.username AS approved_by,
    b.approved_ts
   FROM ((((((public.booking b
     JOIN public.episode e ON ((b.episode_id = e.episode_id)))
     JOIN public.event ev ON ((e.event_id = ev.event_id)))
     JOIN public.resource r ON ((ev.resource_id = r.resource_id)))
     JOIN public.program p ON ((b.program_id = p.program_id)))
     JOIN public."user" u ON ((b.user_id = u.user_id)))
     LEFT JOIN public."user" au ON ((b.approved_by_user_id = au.user_id)))
  ORDER BY b.create_ts DESC;


ALTER VIEW public.v_booking_requests OWNER TO itmdemo;

--
-- TOC entry 237 (class 1259 OID 16706)
-- Name: v_episode_availability; Type: VIEW; Schema: public; Owner: itmdemo
--

CREATE VIEW public.v_episode_availability AS
 SELECT e.episode_id,
    e.episode_start_date_time,
    e.episode_end_date_time,
    e.episode_duration,
    e.episode_title,
    e.episode_price,
    e.episode_status,
    e.assigned_to_program_id,
    r.resource_name AS rink_name,
    f.facility_name,
    p.program_name AS assigned_to_program,
        CASE
            WHEN ((e.episode_status)::text = 'available'::text) THEN 'Available for Booking'::character varying
            WHEN ((e.episode_status)::text = 'assigned'::text) THEN 'Assigned - Can Request'::character varying
            WHEN ((e.episode_status)::text = 'pending'::text) THEN 'Booking Pending'::character varying
            WHEN ((e.episode_status)::text = 'booked'::text) THEN 'Booked'::character varying
            ELSE e.episode_status
        END AS status_display
   FROM ((((public.episode e
     JOIN public.event ev ON ((e.event_id = ev.event_id)))
     JOIN public.resource r ON ((ev.resource_id = r.resource_id)))
     JOIN public.facility f ON ((r.facility_id = f.facility_id)))
     LEFT JOIN public.program p ON ((e.assigned_to_program_id = p.program_id)))
  WHERE (e.episode_start_date_time >= CURRENT_TIMESTAMP)
  ORDER BY e.episode_start_date_time;


ALTER VIEW public.v_episode_availability OWNER TO itmdemo;

--
-- TOC entry 265 (class 1259 OID 17321)
-- Name: v_request_summary; Type: VIEW; Schema: public; Owner: itmdemo
--

CREATE VIEW public.v_request_summary AS
 SELECT r.request_id,
    r.request_number,
    r.user_id,
    r.program_id,
    r.episode_id,
    r.facility_id,
    r.resource_id,
    r.requested_start_time,
    r.requested_end_time,
    r.request_duration,
    r.episode_price,
    r.request_notes,
    r.priority,
    r.request_status,
    r.submitted_at,
    r.reviewed_at,
    r.expires_at,
    u.username AS requester_username,
    u.first_name AS requester_first_name,
    u.last_name AS requester_last_name,
    u.email AS requester_email,
    reviewer.username AS reviewer_username,
    reviewer.first_name AS reviewer_first_name,
    reviewer.last_name AS reviewer_last_name,
    p.program_name,
    pt.program_type_name,
    f.facility_name,
    f.facility_time_zone,
    res.resource_name,
    e.episode_status AS current_episode_status,
        CASE
            WHEN ((r.expires_at IS NOT NULL) AND (r.expires_at > CURRENT_TIMESTAMP)) THEN (EXTRACT(epoch FROM ((r.expires_at)::timestamp with time zone - CURRENT_TIMESTAMP)) / (3600)::numeric)
            ELSE NULL::numeric
        END AS hours_until_expiry
   FROM (((((((public.ice_time_request r
     JOIN public."user" u ON ((r.user_id = u.user_id)))
     LEFT JOIN public."user" reviewer ON ((r.reviewed_by_user_id = reviewer.user_id)))
     JOIN public.program p ON ((r.program_id = p.program_id)))
     LEFT JOIN public.program_type pt ON ((p.program_type_id = pt.program_type_id)))
     JOIN public.facility f ON ((r.facility_id = f.facility_id)))
     JOIN public.resource res ON ((r.resource_id = res.resource_id)))
     JOIN public.episode e ON ((r.episode_id = e.episode_id)))
  ORDER BY r.submitted_at DESC;


ALTER VIEW public.v_request_summary OWNER TO itmdemo;

--
-- TOC entry 264 (class 1259 OID 17316)
-- Name: v_shopping_cart_details; Type: VIEW; Schema: public; Owner: itmdemo
--

CREATE VIEW public.v_shopping_cart_details AS
 SELECT sc.cart_id,
    sc.user_id,
    sc.program_id,
    sc.episode_id,
    sc.facility_id,
    sc.resource_id,
    sc.episode_start_date_time,
    sc.episode_end_date_time,
    sc.episode_title,
    sc.episode_price,
    sc.resource_name,
    sc.facility_name,
    sc.added_at,
    sc.notes,
    sc.priority,
    u.username,
    u.first_name,
    u.last_name,
    u.email,
    p.program_name,
    pt.program_type_name,
    e.episode_status,
    (EXTRACT(epoch FROM (sc.episode_end_date_time - sc.episode_start_date_time)) / (60)::numeric) AS duration_minutes
   FROM ((((public.shopping_cart sc
     JOIN public."user" u ON ((sc.user_id = u.user_id)))
     JOIN public.program p ON ((sc.program_id = p.program_id)))
     LEFT JOIN public.program_type pt ON ((p.program_type_id = pt.program_type_id)))
     JOIN public.episode e ON ((sc.episode_id = e.episode_id)))
  ORDER BY sc.added_at DESC;


ALTER VIEW public.v_shopping_cart_details OWNER TO itmdemo;

--
-- TOC entry 260 (class 1259 OID 17248)
-- Name: websocket_session; Type: TABLE; Schema: public; Owner: itmdemo
--

CREATE TABLE public.websocket_session (
    session_id character varying(255) NOT NULL,
    user_id integer NOT NULL,
    socket_id character varying(255) NOT NULL,
    facility_ids integer[] DEFAULT '{}'::integer[],
    program_ids integer[] DEFAULT '{}'::integer[],
    user_agent text,
    ip_address inet,
    connected_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_activity timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    joined_rooms character varying(100)[] DEFAULT '{}'::character varying[]
);


ALTER TABLE public.websocket_session OWNER TO itmdemo;

--
-- TOC entry 3863 (class 0 OID 0)
-- Dependencies: 260
-- Name: TABLE websocket_session; Type: COMMENT; Schema: public; Owner: itmdemo
--

COMMENT ON TABLE public.websocket_session IS 'Active WebSocket connections for real-time features';


--
-- TOC entry 3864 (class 0 OID 0)
-- Dependencies: 260
-- Name: COLUMN websocket_session.joined_rooms; Type: COMMENT; Schema: public; Owner: itmdemo
--

COMMENT ON COLUMN public.websocket_session.joined_rooms IS 'Socket.IO rooms this session has joined';


--
-- TOC entry 3409 (class 2604 OID 16897)
-- Name: audit_log audit_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN audit_id SET DEFAULT nextval('public.audit_log_audit_id_seq'::regclass);


--
-- TOC entry 3393 (class 2604 OID 16596)
-- Name: booking booking_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.booking ALTER COLUMN booking_id SET DEFAULT nextval('public.booking_booking_id_seq'::regclass);


--
-- TOC entry 3377 (class 2604 OID 16550)
-- Name: episode episode_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.episode ALTER COLUMN episode_id SET DEFAULT nextval('public.episode_episode_id_seq'::regclass);


--
-- TOC entry 3355 (class 2604 OID 16475)
-- Name: event event_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.event ALTER COLUMN event_id SET DEFAULT nextval('public.event_event_id_seq'::regclass);


--
-- TOC entry 3326 (class 2604 OID 16403)
-- Name: facility facility_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility ALTER COLUMN facility_id SET DEFAULT nextval('public.facility_facility_id_seq'::regclass);


--
-- TOC entry 3421 (class 2604 OID 16975)
-- Name: facility_holiday holiday_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility_holiday ALTER COLUMN holiday_id SET DEFAULT nextval('public.facility_holiday_holiday_id_seq'::regclass);


--
-- TOC entry 3411 (class 2604 OID 16928)
-- Name: facility_hours hours_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility_hours ALTER COLUMN hours_id SET DEFAULT nextval('public.facility_hours_hours_id_seq'::regclass);


--
-- TOC entry 3425 (class 2604 OID 16992)
-- Name: facility_maintenance maintenance_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility_maintenance ALTER COLUMN maintenance_id SET DEFAULT nextval('public.facility_maintenance_maintenance_id_seq'::regclass);


--
-- TOC entry 3415 (class 2604 OID 16946)
-- Name: facility_pricing pricing_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility_pricing ALTER COLUMN pricing_id SET DEFAULT nextval('public.facility_pricing_pricing_id_seq'::regclass);


--
-- TOC entry 3432 (class 2604 OID 17185)
-- Name: ice_time_request request_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.ice_time_request ALTER COLUMN request_id SET DEFAULT nextval('public.ice_time_request_request_id_seq'::regclass);


--
-- TOC entry 3400 (class 2604 OID 16623)
-- Name: notification notification_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.notification ALTER COLUMN notification_id SET DEFAULT nextval('public.notification_notification_id_seq'::regclass);


--
-- TOC entry 3370 (class 2604 OID 16529)
-- Name: program program_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.program ALTER COLUMN program_id SET DEFAULT nextval('public.program_program_id_seq'::regclass);


--
-- TOC entry 3364 (class 2604 OID 16512)
-- Name: program_type program_type_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.program_type ALTER COLUMN program_type_id SET DEFAULT nextval('public.program_type_program_type_id_seq'::regclass);


--
-- TOC entry 3438 (class 2604 OID 17233)
-- Name: realtime_notification notification_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.realtime_notification ALTER COLUMN notification_id SET DEFAULT nextval('public.realtime_notification_notification_id_seq'::regclass);


--
-- TOC entry 3407 (class 2604 OID 16866)
-- Name: recurrence_exception exception_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.recurrence_exception ALTER COLUMN exception_id SET DEFAULT nextval('public.recurrence_exception_exception_id_seq'::regclass);


--
-- TOC entry 3403 (class 2604 OID 16848)
-- Name: recurrence_pattern pattern_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.recurrence_pattern ALTER COLUMN pattern_id SET DEFAULT nextval('public.recurrence_pattern_pattern_id_seq'::regclass);


--
-- TOC entry 3448 (class 2604 OID 17269)
-- Name: request_status_history history_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.request_status_history ALTER COLUMN history_id SET DEFAULT nextval('public.request_status_history_history_id_seq'::regclass);


--
-- TOC entry 3348 (class 2604 OID 16454)
-- Name: resource resource_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.resource ALTER COLUMN resource_id SET DEFAULT nextval('public.resource_resource_id_seq'::regclass);


--
-- TOC entry 3397 (class 2604 OID 16612)
-- Name: resource_type resource_type_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.resource_type ALTER COLUMN resource_type_id SET DEFAULT nextval('public.resource_type_resource_type_id_seq'::regclass);


--
-- TOC entry 3429 (class 2604 OID 17146)
-- Name: shopping_cart cart_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.shopping_cart ALTER COLUMN cart_id SET DEFAULT nextval('public.shopping_cart_cart_id_seq'::regclass);


--
-- TOC entry 3389 (class 2604 OID 16579)
-- Name: user user_id; Type: DEFAULT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public."user" ALTER COLUMN user_id SET DEFAULT nextval('public.user_user_id_seq'::regclass);


--
-- TOC entry 3802 (class 0 OID 16894)
-- Dependencies: 244
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.audit_log (audit_id, table_name, record_id, action, user_id, username, changed_data, old_data, new_data, ip_address, user_agent, "timestamp") FROM stdin;
1	episode	2	UPDATE	\N	\N	{"update_ts": "2025-05-29T04:35:08.601767", "episode_end_date_time": "2025-06-02T01:00:00", "episode_start_date_time": "2025-06-02T00:00:00"}	{"team_id": null, "event_id": 2, "create_ts": "2025-05-29T03:29:08.371735", "update_ts": "2025-05-29T03:31:35.504291", "created_by": "burnsville_admin", "episode_id": 2, "program_id": null, "updated_by": "burnsville_admin", "episode_url": null, "schedule_id": null, "is_recurring": false, "episode_color": null, "episode_price": 150.00, "episode_title": "Ice Time - Gary Harker Rink", "episode_seq_no": 0, "episode_status": "available", "episode_duration": 60, "episode_description": null, "episode_end_date_time": "2025-05-31T20:00:00", "assigned_to_program_id": null, "episode_start_date_time": "2025-05-31T19:00:00"}	{"team_id": null, "event_id": 2, "create_ts": "2025-05-29T03:29:08.371735", "update_ts": "2025-05-29T04:35:08.601767", "created_by": "burnsville_admin", "episode_id": 2, "program_id": null, "updated_by": "burnsville_admin", "episode_url": null, "schedule_id": null, "is_recurring": false, "episode_color": null, "episode_price": 150.00, "episode_title": "Ice Time - Gary Harker Rink", "episode_seq_no": 0, "episode_status": "available", "episode_duration": 60, "episode_description": null, "episode_end_date_time": "2025-06-02T01:00:00", "assigned_to_program_id": null, "episode_start_date_time": "2025-06-02T00:00:00"}	\N	\N	2025-05-29 04:35:08.601767
6	event	1	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 18:06:54.483245
7	event	2	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 18:09:19.01838
8	episode	1	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 18:09:19.116325
9	episode	1	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-01 18:46:00.937336
10	episode	1	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-01 18:46:15.498784
11	episode	1	DELETE	\N	\N	\N	\N	\N	\N	\N	2025-06-01 18:50:23.90293
12	event	3	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 18:50:40.084976
13	episode	2	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 18:50:40.199119
14	event	4	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 20:11:58.063317
15	episode	3	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 20:11:58.166528
16	event	5	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 20:12:05.919705
17	episode	4	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 20:12:05.987472
18	event	6	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 20:13:03.981001
19	episode	5	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 20:13:04.045264
20	event	7	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 20:13:38.750169
21	episode	6	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 20:13:38.847703
22	episode	6	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-01 20:32:32.448933
23	episode	6	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-01 20:32:35.372494
24	episode	6	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-01 20:32:38.893293
25	episode	5	DELETE	\N	\N	\N	\N	\N	\N	\N	2025-06-01 20:33:01.674725
26	episode	6	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-01 21:09:19.268449
27	event	8	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 21:10:32.239227
28	episode	7	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 21:10:32.312402
29	episode	3	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-01 21:11:15.170721
30	episode	3	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-01 21:11:21.361716
31	event	9	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 23:01:51.789808
32	episode	8	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 23:01:51.867706
33	event	10	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 23:15:10.149156
34	episode	9	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 23:15:10.217819
35	episode	4	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-01 23:36:27.995497
36	episode	2	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-01 23:36:31.375282
37	episode	4	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-01 23:36:48.003901
38	episode	2	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-01 23:38:31.716554
39	episode	2	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-01 23:38:39.588257
40	episode	2	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-01 23:39:16.033761
41	event	11	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 23:39:38.216444
42	episode	10	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 23:39:38.288429
43	event	12	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 23:40:05.731429
44	episode	11	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-01 23:40:05.869114
45	episode	2	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-01 23:50:12.496487
46	episode	10	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-02 02:19:57.295777
47	episode	10	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-02 02:20:00.923735
48	episode	10	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-02 02:20:04.105532
49	episode	2	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-02 02:24:51.148469
50	episode	7	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-02 02:24:59.989394
51	episode	7	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-02 02:25:04.986777
52	episode	7	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-02 02:26:20.533624
53	event	13	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 02:27:28.604857
54	episode	12	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 02:27:28.679707
55	episode	10	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-02 02:39:36.865159
56	episode	7	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-02 02:45:23.299435
57	episode	10	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-02 02:45:52.372138
58	episode	7	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-02 02:48:43.175572
59	episode	7	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-02 02:57:09.861361
60	episode	7	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-02 02:57:22.612097
61	event	14	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 02:59:42.314794
62	episode	13	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 02:59:42.396732
63	event	15	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 03:00:06.411954
64	episode	14	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 03:00:06.481533
65	event	16	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 03:00:18.269785
66	episode	15	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 03:00:18.33218
67	event	17	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 03:00:30.496785
68	episode	16	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 03:00:30.56102
69	event	18	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 03:17:59.97063
70	episode	17	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 03:18:00.046049
71	event	19	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 03:18:10.220994
72	episode	18	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 03:18:10.283762
73	event	20	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 03:18:50.587579
74	episode	19	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 03:18:50.672832
75	event	21	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 03:53:02.861008
76	episode	20	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 03:53:02.9301
77	event	22	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 03:55:39.778276
78	episode	21	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 03:55:39.850722
79	event	23	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 21:53:27.480069
80	episode	22	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 21:53:27.549494
81	event	24	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 22:00:33.025844
82	episode	23	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 22:00:33.091206
83	event	25	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 22:20:26.801631
84	episode	24	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 22:20:26.886685
85	event	26	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 22:32:51.464389
86	episode	25	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 22:32:51.532183
87	event	27	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 23:09:01.14546
88	episode	26	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 23:09:01.222476
89	event	28	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 23:10:11.478926
90	episode	27	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 23:10:11.568929
91	event	29	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 23:25:52.385043
92	episode	28	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 23:25:52.455696
93	event	30	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 23:27:17.460243
94	episode	29	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-02 23:27:17.529727
95	episode	29	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-02 23:27:24.108369
96	episode	29	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-02 23:29:33.126374
97	episode	29	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-02 23:31:32.386821
98	episode	29	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-03 00:15:28.428705
99	episode	29	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-03 00:15:38.801193
100	episode	29	DELETE	\N	\N	\N	\N	\N	\N	\N	2025-06-03 00:15:51.738499
101	event	31	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-03 00:16:15.703271
102	event	32	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-03 00:16:15.801879
103	event	33	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-03 00:16:15.871246
104	episode	30	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-03 00:16:15.938857
105	episode	31	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-03 00:16:16.010768
106	episode	32	INSERT	\N	\N	\N	\N	\N	\N	\N	2025-06-03 00:16:16.075792
107	episode	30	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-03 21:41:40.407707
108	episode	30	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-04 02:48:28.935278
109	episode	30	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-04 02:48:34.882294
110	episode	30	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-04 02:48:47.212016
111	episode	30	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-04 03:02:34.208308
112	episode	30	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-04 03:02:36.050612
113	episode	31	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-04 03:02:45.103291
114	episode	31	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-04 03:05:04.463782
115	episode	32	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-04 03:05:06.953314
116	episode	31	UPDATE	\N	\N	\N	\N	\N	\N	\N	2025-06-04 03:05:25.602235
\.


--
-- TOC entry 3792 (class 0 OID 16593)
-- Dependencies: 232
-- Data for Name: booking; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.booking (booking_id, episode_id, program_id, user_id, booking_status, booking_notes, admin_notes, approved_by_user_id, approved_ts, create_ts, update_ts, created_by, updated_by) FROM stdin;
\.


--
-- TOC entry 3788 (class 0 OID 16547)
-- Dependencies: 228
-- Data for Name: episode; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.episode (episode_id, event_id, schedule_id, program_id, team_id, episode_seq_no, episode_start_date_time, episode_end_date_time, episode_duration, episode_title, episode_description, episode_url, episode_color, episode_price, update_ts, create_ts, created_by, updated_by, episode_status, is_recurring, assigned_to_program_id) FROM stdin;
30	31	\N	\N	\N	0	2025-06-05 08:00:00	2025-06-05 09:00:00	60	Ice Time - Gary Harker Rink		\N	\N	150.00	2025-06-04 03:02:36.050612	2025-06-03 00:17:38.171	burnsville_admin	burnsville_admin	assigned	f	1
32	33	\N	\N	\N	0	2025-06-05 10:00:00	2025-06-05 11:00:00	60	Ice Time - Gary Harker Rink		\N	\N	150.00	2025-06-04 03:05:06.953314	2025-06-03 00:17:38.309	burnsville_admin	burnsville_admin	available	f	\N
31	32	\N	\N	\N	0	2025-06-05 09:00:00	2025-06-05 10:00:00	60	Ice Time - Gary Harker Rink		\N	\N	150.00	2025-06-04 03:05:25.602235	2025-06-03 00:17:38.244	burnsville_admin	burnsville_admin	assigned	f	1
\.


--
-- TOC entry 3782 (class 0 OID 16472)
-- Dependencies: 222
-- Data for Name: event; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.event (event_id, resource_id, all_day, event_start_date, event_start_time, event_end_date, event_end_time, event_start_date_time, event_end_date_time, repeat_mode, repeat_ends, num_occurrences, event_dates, episode_duration, maintenance_interval, event_last_date_time, num_conflicts, create_ts, update_ts, created_by, updated_by, recurrence_pattern_id, is_recurring_master, parent_event_id) FROM stdin;
30	1	\N	2025-06-06	07:00:00	2025-06-06	08:00:00	2025-06-06 07:00:00	2025-06-06 08:00:00	once	\N	\N	\N	60	\N	\N	\N	2025-06-02 23:28:39.718	2025-06-02 23:28:39.718	burnsville_admin	burnsville_admin	\N	f	\N
31	1	\N	2025-06-05	08:00:00	2025-06-05	09:00:00	2025-06-05 08:00:00	2025-06-05 09:00:00	daily	\N	\N	\N	60	\N	\N	\N	2025-06-03 00:17:37.925	2025-06-03 00:17:37.925	burnsville_admin	burnsville_admin	\N	f	\N
32	1	\N	2025-06-06	08:00:00	2025-06-06	09:00:00	2025-06-06 08:00:00	2025-06-06 09:00:00	daily	\N	\N	\N	60	\N	\N	\N	2025-06-03 00:17:38.022	2025-06-03 00:17:38.022	burnsville_admin	burnsville_admin	\N	f	\N
33	1	\N	2025-06-07	08:00:00	2025-06-07	09:00:00	2025-06-07 08:00:00	2025-06-07 09:00:00	daily	\N	\N	\N	60	\N	\N	\N	2025-06-03 00:17:38.102	2025-06-03 00:17:38.102	burnsville_admin	burnsville_admin	\N	f	\N
\.


--
-- TOC entry 3778 (class 0 OID 16400)
-- Dependencies: 218
-- Data for Name: facility; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.facility (facility_id, org_id, location_id, facility_contact_id, facility_admin_user_id, facility_name, facility_address_1, facility_address_2, facility_city, facility_state, state_id, facility_postal_code, facility_country, country_id, facility_time_zone, facility_latitude, facility_longitude, facility_daily_start_time, facility_daily_end_time, facility_default_duration, facility_default_maint_int, facility_tax_rate, create_ts, update_ts, created_by, updated_by, admin_user_id, business_hours, ice_resurfacing_duration, min_booking_duration, max_booking_duration, advance_booking_days, cancellation_hours, pricing_rules, maintenance_schedule) FROM stdin;
1	\N	\N	\N	\N	Burnsville Arena	251 Civic Center Parkway	\N	Burnsville	MN	\N	55337	USA	\N	America/Chicago	\N	\N	06:00:00	23:00:00	60	\N	\N	2025-05-29 03:01:45.738077	2025-05-29 03:23:00.538842	system	system	17	{}	15	60	180	90	24	{}	{}
\.


--
-- TOC entry 3808 (class 0 OID 16972)
-- Dependencies: 251
-- Data for Name: facility_holiday; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.facility_holiday (holiday_id, facility_id, holiday_date, holiday_name, is_closed, special_hours_open, special_hours_close, pricing_multiplier, create_ts) FROM stdin;
\.


--
-- TOC entry 3804 (class 0 OID 16925)
-- Dependencies: 247
-- Data for Name: facility_hours; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.facility_hours (hours_id, facility_id, day_of_week, open_time, close_time, is_closed, create_ts, update_ts) FROM stdin;
\.


--
-- TOC entry 3810 (class 0 OID 16989)
-- Dependencies: 253
-- Data for Name: facility_maintenance; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.facility_maintenance (maintenance_id, facility_id, resource_id, maintenance_type, start_time, duration_minutes, days_of_week, is_active, created_by, create_ts, update_ts) FROM stdin;
\.


--
-- TOC entry 3806 (class 0 OID 16943)
-- Dependencies: 249
-- Data for Name: facility_pricing; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.facility_pricing (pricing_id, facility_id, resource_type_id, program_type_id, day_of_week, start_time, end_time, base_price, prime_time_multiplier, weekend_multiplier, holiday_multiplier, effective_date, expiry_date, created_by, create_ts, update_ts) FROM stdin;
\.


--
-- TOC entry 3814 (class 0 OID 17182)
-- Dependencies: 257
-- Data for Name: ice_time_request; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.ice_time_request (request_id, request_number, user_id, program_id, episode_id, facility_id, resource_id, requested_start_time, requested_end_time, request_duration, episode_price, request_notes, priority, request_status, submitted_at, reviewed_at, reviewed_by_user_id, admin_notes, expires_at, created_by, updated_by, create_ts, update_ts) FROM stdin;
\.


--
-- TOC entry 3796 (class 0 OID 16620)
-- Dependencies: 236
-- Data for Name: notification; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.notification (notification_id, user_id, notification_type, notification_title, notification_message, related_booking_id, related_episode_id, is_read, read_ts, create_ts) FROM stdin;
\.


--
-- TOC entry 3786 (class 0 OID 16526)
-- Dependencies: 226
-- Data for Name: program; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.program (program_id, program_admin_user_id, program_type_id, program_name, program_color, create_ts, update_ts, created_by, updated_by, scheduler_user_id) FROM stdin;
1	\N	1	OS Hockey	#1e40af	2025-05-29 03:01:45.738077	2025-05-29 03:01:45.738077	system	\N	14
\.


--
-- TOC entry 3784 (class 0 OID 16509)
-- Dependencies: 224
-- Data for Name: program_type; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.program_type (program_type_id, program_type_name, program_type_desc, create_ts, update_ts, created_by, updated_by) FROM stdin;
1	Hockey Camps	Youth and adult hockey camp programs	2025-05-29 03:01:45.738077	2025-05-29 03:01:45.738077	system	\N
\.


--
-- TOC entry 3816 (class 0 OID 17230)
-- Dependencies: 259
-- Data for Name: realtime_notification; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.realtime_notification (notification_id, target_type, target_id, event_type, event_data, title, message, websocket_rooms, sent_at, is_delivered, is_persistent, expires_at, created_at, created_by_user_id) FROM stdin;
1	global	\N	system	{"type": "welcome"}	System Ready	Real-time notification system initialized	\N	\N	f	f	2025-06-04 04:18:24.31563	2025-06-04 04:17:24.31563	\N
\.


--
-- TOC entry 3800 (class 0 OID 16863)
-- Dependencies: 242
-- Data for Name: recurrence_exception; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.recurrence_exception (exception_id, event_id, exception_date, reason, created_by, create_ts) FROM stdin;
\.


--
-- TOC entry 3798 (class 0 OID 16845)
-- Dependencies: 240
-- Data for Name: recurrence_pattern; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.recurrence_pattern (pattern_id, event_id, recurrence_type, interval_value, days_of_week, day_of_month, week_of_month, month_of_year, max_occurrences, recurrence_end_date, created_by, create_ts, update_ts) FROM stdin;
\.


--
-- TOC entry 3819 (class 0 OID 17266)
-- Dependencies: 262
-- Data for Name: request_status_history; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.request_status_history (history_id, request_id, old_status, new_status, changed_by_user_id, change_reason, changed_at, ip_address, user_agent) FROM stdin;
\.


--
-- TOC entry 3780 (class 0 OID 16451)
-- Dependencies: 220
-- Data for Name: resource; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.resource (resource_id, facility_id, resource_name, resource_type_id, resource_status, resource_desc, create_ts, update_ts, created_by, updated_by) FROM stdin;
1	1	Gary Harker Rink	1	active	Main ice rink at Burnsville Arena	2025-05-29 03:01:45.738077	\N	system	\N
2	1	Rink 2	1	active	Secondary ice rink at Burnsville Arena	2025-05-29 03:01:45.738077	\N	system	\N
\.


--
-- TOC entry 3794 (class 0 OID 16609)
-- Dependencies: 234
-- Data for Name: resource_type; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.resource_type (resource_type_id, resource_type_name, resource_type_desc, create_ts, update_ts, created_by, updated_by) FROM stdin;
1	Ice Rink	Standard ice rink for hockey and figure skating	2025-05-29 00:59:46.650593	2025-05-29 00:59:46.650593	system	\N
2	Practice Rink	Smaller practice ice surface	2025-05-29 00:59:46.650593	2025-05-29 00:59:46.650593	system	\N
3	Studio Rink	Small studio ice for private lessons	2025-05-29 00:59:46.650593	2025-05-29 00:59:46.650593	system	\N
\.


--
-- TOC entry 3812 (class 0 OID 17143)
-- Dependencies: 255
-- Data for Name: shopping_cart; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.shopping_cart (cart_id, user_id, program_id, episode_id, facility_id, resource_id, episode_start_date_time, episode_end_date_time, episode_title, episode_price, resource_name, facility_name, added_at, session_id, notes, priority) FROM stdin;
\.


--
-- TOC entry 3790 (class 0 OID 16576)
-- Dependencies: 230
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public."user" (user_id, username, email, password_hash, user_type, first_name, last_name, phone, is_active, last_login_ts, create_ts, update_ts, created_by, updated_by) FROM stdin;
13	admin	admin@icearena.com	$2b$10$WJjSZcIkQP2RSoFnlJxHdOcHQtdv6wktdITZxDibr5dHXrrDHZFJi	admin	Arena	Administrator	\N	t	2025-05-29 02:46:25.987707	2025-05-29 02:35:11.719492	2025-06-01 02:38:39.916083	\N	\N
14	hockey_scheduler	hockey@icearena.com	$2b$10$WJjSZcIkQP2RSoFnlJxHdOcHQtdv6wktdITZxDibr5dHXrrDHZFJi	scheduler	Hockey	Scheduler	\N	t	\N	2025-05-29 02:35:11.719492	2025-06-01 02:38:39.916083	\N	\N
15	figure_scheduler	figure@icearena.com	$2b$10$WJjSZcIkQP2RSoFnlJxHdOcHQtdv6wktdITZxDibr5dHXrrDHZFJi	scheduler	Figure	Scheduler	\N	t	\N	2025-05-29 02:35:11.719492	2025-06-01 02:38:39.916083	\N	\N
17	burnsville_admin	admin@burnsvillearena.com	$2b$10$WJjSZcIkQP2RSoFnlJxHdOcHQtdv6wktdITZxDibr5dHXrrDHZFJi	admin	Burnsville	Administrator	952-895-4650	t	2025-06-04 02:49:10.114	2025-05-29 03:09:42.723539	2025-06-04 02:47:47.103613	system	\N
\.


--
-- TOC entry 3817 (class 0 OID 17248)
-- Dependencies: 260
-- Data for Name: websocket_session; Type: TABLE DATA; Schema: public; Owner: itmdemo
--

COPY public.websocket_session (session_id, user_id, socket_id, facility_ids, program_ids, user_agent, ip_address, connected_at, last_activity, joined_rooms) FROM stdin;
\.


--
-- TOC entry 3865 (class 0 OID 0)
-- Dependencies: 243
-- Name: audit_log_audit_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.audit_log_audit_id_seq', 116, true);


--
-- TOC entry 3866 (class 0 OID 0)
-- Dependencies: 231
-- Name: booking_booking_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.booking_booking_id_seq', 1, false);


--
-- TOC entry 3867 (class 0 OID 0)
-- Dependencies: 227
-- Name: episode_episode_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.episode_episode_id_seq', 32, true);


--
-- TOC entry 3868 (class 0 OID 0)
-- Dependencies: 221
-- Name: event_event_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.event_event_id_seq', 33, true);


--
-- TOC entry 3869 (class 0 OID 0)
-- Dependencies: 217
-- Name: facility_facility_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.facility_facility_id_seq', 1, true);


--
-- TOC entry 3870 (class 0 OID 0)
-- Dependencies: 250
-- Name: facility_holiday_holiday_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.facility_holiday_holiday_id_seq', 1, false);


--
-- TOC entry 3871 (class 0 OID 0)
-- Dependencies: 246
-- Name: facility_hours_hours_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.facility_hours_hours_id_seq', 1, false);


--
-- TOC entry 3872 (class 0 OID 0)
-- Dependencies: 252
-- Name: facility_maintenance_maintenance_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.facility_maintenance_maintenance_id_seq', 1, false);


--
-- TOC entry 3873 (class 0 OID 0)
-- Dependencies: 248
-- Name: facility_pricing_pricing_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.facility_pricing_pricing_id_seq', 1, false);


--
-- TOC entry 3874 (class 0 OID 0)
-- Dependencies: 256
-- Name: ice_time_request_request_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.ice_time_request_request_id_seq', 1, false);


--
-- TOC entry 3875 (class 0 OID 0)
-- Dependencies: 235
-- Name: notification_notification_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.notification_notification_id_seq', 1, false);


--
-- TOC entry 3876 (class 0 OID 0)
-- Dependencies: 225
-- Name: program_program_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.program_program_id_seq', 1, true);


--
-- TOC entry 3877 (class 0 OID 0)
-- Dependencies: 223
-- Name: program_type_program_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.program_type_program_type_id_seq', 1, true);


--
-- TOC entry 3878 (class 0 OID 0)
-- Dependencies: 258
-- Name: realtime_notification_notification_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.realtime_notification_notification_id_seq', 1, true);


--
-- TOC entry 3879 (class 0 OID 0)
-- Dependencies: 241
-- Name: recurrence_exception_exception_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.recurrence_exception_exception_id_seq', 1, false);


--
-- TOC entry 3880 (class 0 OID 0)
-- Dependencies: 239
-- Name: recurrence_pattern_pattern_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.recurrence_pattern_pattern_id_seq', 1, false);


--
-- TOC entry 3881 (class 0 OID 0)
-- Dependencies: 263
-- Name: request_number_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.request_number_seq', 1, false);


--
-- TOC entry 3882 (class 0 OID 0)
-- Dependencies: 261
-- Name: request_status_history_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.request_status_history_history_id_seq', 1, false);


--
-- TOC entry 3883 (class 0 OID 0)
-- Dependencies: 219
-- Name: resource_resource_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.resource_resource_id_seq', 2, true);


--
-- TOC entry 3884 (class 0 OID 0)
-- Dependencies: 233
-- Name: resource_type_resource_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.resource_type_resource_type_id_seq', 3, true);


--
-- TOC entry 3885 (class 0 OID 0)
-- Dependencies: 254
-- Name: shopping_cart_cart_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.shopping_cart_cart_id_seq', 1, false);


--
-- TOC entry 3886 (class 0 OID 0)
-- Dependencies: 229
-- Name: user_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: itmdemo
--

SELECT pg_catalog.setval('public.user_user_id_seq', 18, true);


--
-- TOC entry 3516 (class 2606 OID 16903)
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (audit_id);


--
-- TOC entry 3493 (class 2606 OID 16604)
-- Name: booking booking_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.booking
    ADD CONSTRAINT booking_pkey PRIMARY KEY (booking_id);


--
-- TOC entry 3474 (class 2606 OID 16563)
-- Name: episode episode_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.episode
    ADD CONSTRAINT episode_pkey PRIMARY KEY (episode_id);


--
-- TOC entry 3466 (class 2606 OID 16486)
-- Name: event event_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.event
    ADD CONSTRAINT event_pkey PRIMARY KEY (event_id);


--
-- TOC entry 3529 (class 2606 OID 16982)
-- Name: facility_holiday facility_holiday_facility_id_holiday_date_key; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility_holiday
    ADD CONSTRAINT facility_holiday_facility_id_holiday_date_key UNIQUE (facility_id, holiday_date);


--
-- TOC entry 3531 (class 2606 OID 16980)
-- Name: facility_holiday facility_holiday_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility_holiday
    ADD CONSTRAINT facility_holiday_pkey PRIMARY KEY (holiday_id);


--
-- TOC entry 3521 (class 2606 OID 16936)
-- Name: facility_hours facility_hours_facility_id_day_of_week_key; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility_hours
    ADD CONSTRAINT facility_hours_facility_id_day_of_week_key UNIQUE (facility_id, day_of_week);


--
-- TOC entry 3523 (class 2606 OID 16934)
-- Name: facility_hours facility_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility_hours
    ADD CONSTRAINT facility_hours_pkey PRIMARY KEY (hours_id);


--
-- TOC entry 3534 (class 2606 OID 16999)
-- Name: facility_maintenance facility_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility_maintenance
    ADD CONSTRAINT facility_maintenance_pkey PRIMARY KEY (maintenance_id);


--
-- TOC entry 3461 (class 2606 OID 16420)
-- Name: facility facility_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility
    ADD CONSTRAINT facility_pkey PRIMARY KEY (facility_id);


--
-- TOC entry 3526 (class 2606 OID 16955)
-- Name: facility_pricing facility_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility_pricing
    ADD CONSTRAINT facility_pricing_pkey PRIMARY KEY (pricing_id);


--
-- TOC entry 3545 (class 2606 OID 17196)
-- Name: ice_time_request ice_time_request_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.ice_time_request
    ADD CONSTRAINT ice_time_request_pkey PRIMARY KEY (request_id);


--
-- TOC entry 3547 (class 2606 OID 17198)
-- Name: ice_time_request ice_time_request_request_number_key; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.ice_time_request
    ADD CONSTRAINT ice_time_request_request_number_key UNIQUE (request_number);


--
-- TOC entry 3506 (class 2606 OID 16629)
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (notification_id);


--
-- TOC entry 3472 (class 2606 OID 16537)
-- Name: program program_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.program
    ADD CONSTRAINT program_pkey PRIMARY KEY (program_id);


--
-- TOC entry 3469 (class 2606 OID 16521)
-- Name: program_type program_type_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.program_type
    ADD CONSTRAINT program_type_pkey PRIMARY KEY (program_type_id);


--
-- TOC entry 3559 (class 2606 OID 17242)
-- Name: realtime_notification realtime_notification_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.realtime_notification
    ADD CONSTRAINT realtime_notification_pkey PRIMARY KEY (notification_id);


--
-- TOC entry 3512 (class 2606 OID 16871)
-- Name: recurrence_exception recurrence_exception_event_id_exception_date_key; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.recurrence_exception
    ADD CONSTRAINT recurrence_exception_event_id_exception_date_key UNIQUE (event_id, exception_date);


--
-- TOC entry 3514 (class 2606 OID 16869)
-- Name: recurrence_exception recurrence_exception_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.recurrence_exception
    ADD CONSTRAINT recurrence_exception_pkey PRIMARY KEY (exception_id);


--
-- TOC entry 3509 (class 2606 OID 16856)
-- Name: recurrence_pattern recurrence_pattern_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.recurrence_pattern
    ADD CONSTRAINT recurrence_pattern_pkey PRIMARY KEY (pattern_id);


--
-- TOC entry 3570 (class 2606 OID 17274)
-- Name: request_status_history request_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.request_status_history
    ADD CONSTRAINT request_status_history_pkey PRIMARY KEY (history_id);


--
-- TOC entry 3464 (class 2606 OID 16462)
-- Name: resource resource_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.resource
    ADD CONSTRAINT resource_pkey PRIMARY KEY (resource_id);


--
-- TOC entry 3501 (class 2606 OID 16618)
-- Name: resource_type resource_type_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.resource_type
    ADD CONSTRAINT resource_type_pkey PRIMARY KEY (resource_type_id);


--
-- TOC entry 3541 (class 2606 OID 17153)
-- Name: shopping_cart shopping_cart_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.shopping_cart
    ADD CONSTRAINT shopping_cart_pkey PRIMARY KEY (cart_id);


--
-- TOC entry 3543 (class 2606 OID 17155)
-- Name: shopping_cart unique_user_episode_cart; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.shopping_cart
    ADD CONSTRAINT unique_user_episode_cart UNIQUE (user_id, episode_id);


--
-- TOC entry 3487 (class 2606 OID 16591)
-- Name: user user_email_key; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- TOC entry 3489 (class 2606 OID 16587)
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (user_id);


--
-- TOC entry 3491 (class 2606 OID 16589)
-- Name: user user_username_key; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_username_key UNIQUE (username);


--
-- TOC entry 3566 (class 2606 OID 17259)
-- Name: websocket_session websocket_session_pkey; Type: CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.websocket_session
    ADD CONSTRAINT websocket_session_pkey PRIMARY KEY (session_id);


--
-- TOC entry 3517 (class 1259 OID 16904)
-- Name: idx_audit_log_table; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_audit_log_table ON public.audit_log USING btree (table_name, record_id);


--
-- TOC entry 3518 (class 1259 OID 16905)
-- Name: idx_audit_log_timestamp; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_audit_log_timestamp ON public.audit_log USING btree ("timestamp");


--
-- TOC entry 3519 (class 1259 OID 16906)
-- Name: idx_audit_log_user; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_audit_log_user ON public.audit_log USING btree (user_id);


--
-- TOC entry 3494 (class 1259 OID 16692)
-- Name: idx_booking_create_ts; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_booking_create_ts ON public.booking USING btree (create_ts);


--
-- TOC entry 3495 (class 1259 OID 16688)
-- Name: idx_booking_episode_id; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_booking_episode_id ON public.booking USING btree (episode_id);


--
-- TOC entry 3496 (class 1259 OID 17327)
-- Name: idx_booking_episode_status; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_booking_episode_status ON public.booking USING btree (episode_id, booking_status);


--
-- TOC entry 3497 (class 1259 OID 16689)
-- Name: idx_booking_program_id; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_booking_program_id ON public.booking USING btree (program_id);


--
-- TOC entry 3498 (class 1259 OID 16691)
-- Name: idx_booking_status; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_booking_status ON public.booking USING btree (booking_status);


--
-- TOC entry 3499 (class 1259 OID 16690)
-- Name: idx_booking_user_id; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_booking_user_id ON public.booking USING btree (user_id);


--
-- TOC entry 3536 (class 1259 OID 17287)
-- Name: idx_cart_added_at; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_cart_added_at ON public.shopping_cart USING btree (added_at);


--
-- TOC entry 3537 (class 1259 OID 17288)
-- Name: idx_cart_episode; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_cart_episode ON public.shopping_cart USING btree (episode_id);


--
-- TOC entry 3538 (class 1259 OID 17286)
-- Name: idx_cart_facility; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_cart_facility ON public.shopping_cart USING btree (facility_id);


--
-- TOC entry 3539 (class 1259 OID 17285)
-- Name: idx_cart_user_program; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_cart_user_program ON public.shopping_cart USING btree (user_id, program_id);


--
-- TOC entry 3475 (class 1259 OID 16694)
-- Name: idx_episode_assigned_program; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_episode_assigned_program ON public.episode USING btree (assigned_to_program_id);


--
-- TOC entry 3476 (class 1259 OID 16696)
-- Name: idx_episode_end_date_time; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_episode_end_date_time ON public.episode USING btree (episode_end_date_time);


--
-- TOC entry 3477 (class 1259 OID 16570)
-- Name: idx_episode_program_id; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_episode_program_id ON public.episode USING btree (program_id);


--
-- TOC entry 3478 (class 1259 OID 16569)
-- Name: idx_episode_schedule_id; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_episode_schedule_id ON public.episode USING btree (schedule_id);


--
-- TOC entry 3479 (class 1259 OID 16695)
-- Name: idx_episode_start_date_time; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_episode_start_date_time ON public.episode USING btree (episode_start_date_time);


--
-- TOC entry 3480 (class 1259 OID 16693)
-- Name: idx_episode_status; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_episode_status ON public.episode USING btree (episode_status);


--
-- TOC entry 3481 (class 1259 OID 17326)
-- Name: idx_episode_status_start_time; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_episode_status_start_time ON public.episode USING btree (episode_status, episode_start_date_time);


--
-- TOC entry 3467 (class 1259 OID 16890)
-- Name: idx_event_parent; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_event_parent ON public.event USING btree (parent_event_id);


--
-- TOC entry 3532 (class 1259 OID 17012)
-- Name: idx_facility_holiday_facility; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_facility_holiday_facility ON public.facility_holiday USING btree (facility_id);


--
-- TOC entry 3524 (class 1259 OID 17010)
-- Name: idx_facility_hours_facility; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_facility_hours_facility ON public.facility_hours USING btree (facility_id);


--
-- TOC entry 3535 (class 1259 OID 17013)
-- Name: idx_facility_maintenance_facility; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_facility_maintenance_facility ON public.facility_maintenance USING btree (facility_id);


--
-- TOC entry 3462 (class 1259 OID 16421)
-- Name: idx_facility_org_id; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_facility_org_id ON public.facility USING btree (org_id);


--
-- TOC entry 3527 (class 1259 OID 17011)
-- Name: idx_facility_pricing_facility; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_facility_pricing_facility ON public.facility_pricing USING btree (facility_id);


--
-- TOC entry 3502 (class 1259 OID 16699)
-- Name: idx_notification_create_ts; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_notification_create_ts ON public.notification USING btree (create_ts);


--
-- TOC entry 3503 (class 1259 OID 16698)
-- Name: idx_notification_is_read; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_notification_is_read ON public.notification USING btree (is_read);


--
-- TOC entry 3504 (class 1259 OID 16697)
-- Name: idx_notification_user_id; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_notification_user_id ON public.notification USING btree (user_id);


--
-- TOC entry 3470 (class 1259 OID 17329)
-- Name: idx_program_scheduler; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_program_scheduler ON public.program USING btree (scheduler_user_id);


--
-- TOC entry 3554 (class 1259 OID 17297)
-- Name: idx_realtime_delivery; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_realtime_delivery ON public.realtime_notification USING btree (is_delivered, sent_at);


--
-- TOC entry 3555 (class 1259 OID 17296)
-- Name: idx_realtime_event; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_realtime_event ON public.realtime_notification USING btree (event_type);


--
-- TOC entry 3556 (class 1259 OID 17298)
-- Name: idx_realtime_expires; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_realtime_expires ON public.realtime_notification USING btree (expires_at);


--
-- TOC entry 3557 (class 1259 OID 17295)
-- Name: idx_realtime_target; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_realtime_target ON public.realtime_notification USING btree (target_type, target_id);


--
-- TOC entry 3510 (class 1259 OID 16889)
-- Name: idx_recurrence_exception_event; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_recurrence_exception_event ON public.recurrence_exception USING btree (event_id);


--
-- TOC entry 3507 (class 1259 OID 16888)
-- Name: idx_recurrence_pattern_event; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_recurrence_pattern_event ON public.recurrence_pattern USING btree (event_id);


--
-- TOC entry 3548 (class 1259 OID 17292)
-- Name: idx_request_episode; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_request_episode ON public.ice_time_request USING btree (episode_id);


--
-- TOC entry 3549 (class 1259 OID 17294)
-- Name: idx_request_expires; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_request_expires ON public.ice_time_request USING btree (expires_at);


--
-- TOC entry 3550 (class 1259 OID 17291)
-- Name: idx_request_facility; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_request_facility ON public.ice_time_request USING btree (facility_id);


--
-- TOC entry 3551 (class 1259 OID 17290)
-- Name: idx_request_status; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_request_status ON public.ice_time_request USING btree (request_status);


--
-- TOC entry 3552 (class 1259 OID 17293)
-- Name: idx_request_submitted; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_request_submitted ON public.ice_time_request USING btree (submitted_at);


--
-- TOC entry 3553 (class 1259 OID 17289)
-- Name: idx_request_user_program; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_request_user_program ON public.ice_time_request USING btree (user_id, program_id);


--
-- TOC entry 3567 (class 1259 OID 17305)
-- Name: idx_status_history_changed; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_status_history_changed ON public.request_status_history USING btree (changed_at);


--
-- TOC entry 3568 (class 1259 OID 17304)
-- Name: idx_status_history_request; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_status_history_request ON public.request_status_history USING btree (request_id);


--
-- TOC entry 3482 (class 1259 OID 16686)
-- Name: idx_user_email; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_user_email ON public."user" USING btree (email);


--
-- TOC entry 3483 (class 1259 OID 16687)
-- Name: idx_user_type; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_user_type ON public."user" USING btree (user_type);


--
-- TOC entry 3484 (class 1259 OID 17328)
-- Name: idx_user_type_active; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_user_type_active ON public."user" USING btree (user_type, is_active);


--
-- TOC entry 3485 (class 1259 OID 16685)
-- Name: idx_user_username; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_user_username ON public."user" USING btree (username);


--
-- TOC entry 3560 (class 1259 OID 17301)
-- Name: idx_websocket_activity; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_websocket_activity ON public.websocket_session USING btree (last_activity);


--
-- TOC entry 3561 (class 1259 OID 17302)
-- Name: idx_websocket_facilities; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_websocket_facilities ON public.websocket_session USING gin (facility_ids);


--
-- TOC entry 3562 (class 1259 OID 17303)
-- Name: idx_websocket_programs; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_websocket_programs ON public.websocket_session USING gin (program_ids);


--
-- TOC entry 3563 (class 1259 OID 17300)
-- Name: idx_websocket_socket; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_websocket_socket ON public.websocket_session USING btree (socket_id);


--
-- TOC entry 3564 (class 1259 OID 17299)
-- Name: idx_websocket_user; Type: INDEX; Schema: public; Owner: itmdemo
--

CREATE INDEX idx_websocket_user ON public.websocket_session USING btree (user_id);


--
-- TOC entry 3622 (class 2620 OID 16909)
-- Name: booking trg_audit_booking; Type: TRIGGER; Schema: public; Owner: itmdemo
--

CREATE TRIGGER trg_audit_booking AFTER INSERT OR DELETE OR UPDATE ON public.booking FOR EACH ROW EXECUTE FUNCTION public.fn_create_audit_log();


--
-- TOC entry 3619 (class 2620 OID 16908)
-- Name: episode trg_audit_episode; Type: TRIGGER; Schema: public; Owner: itmdemo
--

CREATE TRIGGER trg_audit_episode AFTER INSERT OR DELETE OR UPDATE ON public.episode FOR EACH ROW EXECUTE FUNCTION public.fn_create_audit_log();


--
-- TOC entry 3614 (class 2620 OID 16910)
-- Name: event trg_audit_event; Type: TRIGGER; Schema: public; Owner: itmdemo
--

CREATE TRIGGER trg_audit_event AFTER INSERT OR DELETE OR UPDATE ON public.event FOR EACH ROW EXECUTE FUNCTION public.fn_create_audit_log();


--
-- TOC entry 3623 (class 2620 OID 16703)
-- Name: booking trg_booking_update_ts; Type: TRIGGER; Schema: public; Owner: itmdemo
--

CREATE TRIGGER trg_booking_update_ts BEFORE UPDATE ON public.booking FOR EACH ROW EXECUTE FUNCTION public.fn_update_booking_timestamp();


--
-- TOC entry 3620 (class 2620 OID 16572)
-- Name: episode trg_episode_update_ts; Type: TRIGGER; Schema: public; Owner: itmdemo
--

CREATE TRIGGER trg_episode_update_ts BEFORE UPDATE ON public.episode FOR EACH ROW EXECUTE FUNCTION public.fn_update_episode_timestamp();


--
-- TOC entry 3615 (class 2620 OID 16493)
-- Name: event trg_event_update_ts; Type: TRIGGER; Schema: public; Owner: itmdemo
--

CREATE TRIGGER trg_event_update_ts BEFORE UPDATE ON public.event FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp_event();


--
-- TOC entry 3612 (class 2620 OID 16423)
-- Name: facility trg_facility_update_ts; Type: TRIGGER; Schema: public; Owner: itmdemo
--

CREATE TRIGGER trg_facility_update_ts BEFORE UPDATE ON public.facility FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- TOC entry 3626 (class 2620 OID 17313)
-- Name: ice_time_request trg_log_request_status_change; Type: TRIGGER; Schema: public; Owner: itmdemo
--

CREATE TRIGGER trg_log_request_status_change AFTER UPDATE ON public.ice_time_request FOR EACH ROW EXECUTE FUNCTION public.log_request_status_change();


--
-- TOC entry 3617 (class 2620 OID 16523)
-- Name: program_type trg_program_type_update_ts; Type: TRIGGER; Schema: public; Owner: itmdemo
--

CREATE TRIGGER trg_program_type_update_ts BEFORE UPDATE ON public.program_type FOR EACH ROW EXECUTE FUNCTION public.fn_update_program_type_timestamp();


--
-- TOC entry 3618 (class 2620 OID 16544)
-- Name: program trg_program_update_ts; Type: TRIGGER; Schema: public; Owner: itmdemo
--

CREATE TRIGGER trg_program_update_ts BEFORE UPDATE ON public.program FOR EACH ROW EXECUTE FUNCTION public.fn_update_program_timestamp();


--
-- TOC entry 3625 (class 2620 OID 16892)
-- Name: recurrence_pattern trg_recurrence_pattern_update_ts; Type: TRIGGER; Schema: public; Owner: itmdemo
--

CREATE TRIGGER trg_recurrence_pattern_update_ts BEFORE UPDATE ON public.recurrence_pattern FOR EACH ROW EXECUTE FUNCTION public.fn_update_recurrence_pattern_timestamp();


--
-- TOC entry 3627 (class 2620 OID 17311)
-- Name: ice_time_request trg_request_update_ts; Type: TRIGGER; Schema: public; Owner: itmdemo
--

CREATE TRIGGER trg_request_update_ts BEFORE UPDATE ON public.ice_time_request FOR EACH ROW EXECUTE FUNCTION public.update_request_timestamp();


--
-- TOC entry 3624 (class 2620 OID 16705)
-- Name: resource_type trg_resource_type_update_ts; Type: TRIGGER; Schema: public; Owner: itmdemo
--

CREATE TRIGGER trg_resource_type_update_ts BEFORE UPDATE ON public.resource_type FOR EACH ROW EXECUTE FUNCTION public.fn_update_resource_type_timestamp();


--
-- TOC entry 3613 (class 2620 OID 16469)
-- Name: resource trg_resource_update_ts; Type: TRIGGER; Schema: public; Owner: itmdemo
--

CREATE TRIGGER trg_resource_update_ts BEFORE UPDATE ON public.resource FOR EACH ROW EXECUTE FUNCTION public.fn_update_resource_timestamp();


--
-- TOC entry 3628 (class 2620 OID 17309)
-- Name: ice_time_request trg_set_request_number; Type: TRIGGER; Schema: public; Owner: itmdemo
--

CREATE TRIGGER trg_set_request_number BEFORE INSERT ON public.ice_time_request FOR EACH ROW EXECUTE FUNCTION public.set_request_number();


--
-- TOC entry 3621 (class 2620 OID 16701)
-- Name: user trg_user_update_ts; Type: TRIGGER; Schema: public; Owner: itmdemo
--

CREATE TRIGGER trg_user_update_ts BEFORE UPDATE ON public."user" FOR EACH ROW EXECUTE FUNCTION public.fn_update_user_timestamp();


--
-- TOC entry 3616 (class 2620 OID 17015)
-- Name: event trg_validate_facility_hours; Type: TRIGGER; Schema: public; Owner: itmdemo
--

CREATE TRIGGER trg_validate_facility_hours BEFORE INSERT OR UPDATE ON public.event FOR EACH ROW EXECUTE FUNCTION public.fn_validate_facility_hours();


--
-- TOC entry 3579 (class 2606 OID 16564)
-- Name: episode event_ibfk1; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.episode
    ADD CONSTRAINT event_ibfk1 FOREIGN KEY (event_id) REFERENCES public.event(event_id);


--
-- TOC entry 3574 (class 2606 OID 16883)
-- Name: event event_parent_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.event
    ADD CONSTRAINT event_parent_event_id_fkey FOREIGN KEY (parent_event_id) REFERENCES public.event(event_id);


--
-- TOC entry 3575 (class 2606 OID 16878)
-- Name: event event_recurrence_pattern_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.event
    ADD CONSTRAINT event_recurrence_pattern_id_fkey FOREIGN KEY (recurrence_pattern_id) REFERENCES public.recurrence_pattern(pattern_id);


--
-- TOC entry 3594 (class 2606 OID 16983)
-- Name: facility_holiday facility_holiday_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility_holiday
    ADD CONSTRAINT facility_holiday_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(facility_id) ON DELETE CASCADE;


--
-- TOC entry 3590 (class 2606 OID 16937)
-- Name: facility_hours facility_hours_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility_hours
    ADD CONSTRAINT facility_hours_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(facility_id) ON DELETE CASCADE;


--
-- TOC entry 3572 (class 2606 OID 16463)
-- Name: resource facility_id_ibfk1; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.resource
    ADD CONSTRAINT facility_id_ibfk1 FOREIGN KEY (facility_id) REFERENCES public.facility(facility_id);


--
-- TOC entry 3595 (class 2606 OID 17000)
-- Name: facility_maintenance facility_maintenance_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility_maintenance
    ADD CONSTRAINT facility_maintenance_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(facility_id) ON DELETE CASCADE;


--
-- TOC entry 3596 (class 2606 OID 17005)
-- Name: facility_maintenance facility_maintenance_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility_maintenance
    ADD CONSTRAINT facility_maintenance_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource(resource_id);


--
-- TOC entry 3591 (class 2606 OID 16956)
-- Name: facility_pricing facility_pricing_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility_pricing
    ADD CONSTRAINT facility_pricing_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(facility_id) ON DELETE CASCADE;


--
-- TOC entry 3592 (class 2606 OID 16966)
-- Name: facility_pricing facility_pricing_program_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility_pricing
    ADD CONSTRAINT facility_pricing_program_type_id_fkey FOREIGN KEY (program_type_id) REFERENCES public.program_type(program_type_id);


--
-- TOC entry 3593 (class 2606 OID 16961)
-- Name: facility_pricing facility_pricing_resource_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility_pricing
    ADD CONSTRAINT facility_pricing_resource_type_id_fkey FOREIGN KEY (resource_type_id) REFERENCES public.resource_type(resource_type_id);


--
-- TOC entry 3581 (class 2606 OID 16635)
-- Name: booking fk_booking_approved_by; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.booking
    ADD CONSTRAINT fk_booking_approved_by FOREIGN KEY (approved_by_user_id) REFERENCES public."user"(user_id);


--
-- TOC entry 3582 (class 2606 OID 16650)
-- Name: booking fk_booking_episode; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.booking
    ADD CONSTRAINT fk_booking_episode FOREIGN KEY (episode_id) REFERENCES public.episode(episode_id);


--
-- TOC entry 3583 (class 2606 OID 16655)
-- Name: booking fk_booking_program; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.booking
    ADD CONSTRAINT fk_booking_program FOREIGN KEY (program_id) REFERENCES public.program(program_id);


--
-- TOC entry 3584 (class 2606 OID 16630)
-- Name: booking fk_booking_user; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.booking
    ADD CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES public."user"(user_id);


--
-- TOC entry 3580 (class 2606 OID 16660)
-- Name: episode fk_episode_assigned_program; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.episode
    ADD CONSTRAINT fk_episode_assigned_program FOREIGN KEY (assigned_to_program_id) REFERENCES public.program(program_id);


--
-- TOC entry 3571 (class 2606 OID 16645)
-- Name: facility fk_facility_admin_user; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.facility
    ADD CONSTRAINT fk_facility_admin_user FOREIGN KEY (admin_user_id) REFERENCES public."user"(user_id);


--
-- TOC entry 3585 (class 2606 OID 16675)
-- Name: notification fk_notification_booking; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT fk_notification_booking FOREIGN KEY (related_booking_id) REFERENCES public.booking(booking_id);


--
-- TOC entry 3586 (class 2606 OID 16680)
-- Name: notification fk_notification_episode; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT fk_notification_episode FOREIGN KEY (related_episode_id) REFERENCES public.episode(episode_id);


--
-- TOC entry 3587 (class 2606 OID 16670)
-- Name: notification fk_notification_user; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES public."user"(user_id);


--
-- TOC entry 3577 (class 2606 OID 16640)
-- Name: program fk_program_scheduler_user; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.program
    ADD CONSTRAINT fk_program_scheduler_user FOREIGN KEY (scheduler_user_id) REFERENCES public."user"(user_id);


--
-- TOC entry 3573 (class 2606 OID 16665)
-- Name: resource fk_resource_type; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.resource
    ADD CONSTRAINT fk_resource_type FOREIGN KEY (resource_type_id) REFERENCES public.resource_type(resource_type_id);


--
-- TOC entry 3602 (class 2606 OID 17209)
-- Name: ice_time_request ice_time_request_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.ice_time_request
    ADD CONSTRAINT ice_time_request_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episode(episode_id);


--
-- TOC entry 3603 (class 2606 OID 17214)
-- Name: ice_time_request ice_time_request_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.ice_time_request
    ADD CONSTRAINT ice_time_request_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(facility_id);


--
-- TOC entry 3604 (class 2606 OID 17204)
-- Name: ice_time_request ice_time_request_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.ice_time_request
    ADD CONSTRAINT ice_time_request_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.program(program_id);


--
-- TOC entry 3605 (class 2606 OID 17219)
-- Name: ice_time_request ice_time_request_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.ice_time_request
    ADD CONSTRAINT ice_time_request_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource(resource_id);


--
-- TOC entry 3606 (class 2606 OID 17224)
-- Name: ice_time_request ice_time_request_reviewed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.ice_time_request
    ADD CONSTRAINT ice_time_request_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES public."user"(user_id);


--
-- TOC entry 3607 (class 2606 OID 17199)
-- Name: ice_time_request ice_time_request_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.ice_time_request
    ADD CONSTRAINT ice_time_request_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id);


--
-- TOC entry 3578 (class 2606 OID 16538)
-- Name: program program_type_ibfk1; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.program
    ADD CONSTRAINT program_type_ibfk1 FOREIGN KEY (program_type_id) REFERENCES public.program_type(program_type_id);


--
-- TOC entry 3608 (class 2606 OID 17243)
-- Name: realtime_notification realtime_notification_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.realtime_notification
    ADD CONSTRAINT realtime_notification_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public."user"(user_id);


--
-- TOC entry 3589 (class 2606 OID 16872)
-- Name: recurrence_exception recurrence_exception_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.recurrence_exception
    ADD CONSTRAINT recurrence_exception_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(event_id) ON DELETE CASCADE;


--
-- TOC entry 3588 (class 2606 OID 16857)
-- Name: recurrence_pattern recurrence_pattern_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.recurrence_pattern
    ADD CONSTRAINT recurrence_pattern_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(event_id) ON DELETE CASCADE;


--
-- TOC entry 3610 (class 2606 OID 17280)
-- Name: request_status_history request_status_history_changed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.request_status_history
    ADD CONSTRAINT request_status_history_changed_by_user_id_fkey FOREIGN KEY (changed_by_user_id) REFERENCES public."user"(user_id);


--
-- TOC entry 3611 (class 2606 OID 17275)
-- Name: request_status_history request_status_history_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.request_status_history
    ADD CONSTRAINT request_status_history_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.ice_time_request(request_id) ON DELETE CASCADE;


--
-- TOC entry 3576 (class 2606 OID 16487)
-- Name: event resource_ibfk1; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.event
    ADD CONSTRAINT resource_ibfk1 FOREIGN KEY (resource_id) REFERENCES public.resource(resource_id);


--
-- TOC entry 3597 (class 2606 OID 17166)
-- Name: shopping_cart shopping_cart_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.shopping_cart
    ADD CONSTRAINT shopping_cart_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episode(episode_id) ON DELETE CASCADE;


--
-- TOC entry 3598 (class 2606 OID 17171)
-- Name: shopping_cart shopping_cart_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.shopping_cart
    ADD CONSTRAINT shopping_cart_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(facility_id) ON DELETE CASCADE;


--
-- TOC entry 3599 (class 2606 OID 17161)
-- Name: shopping_cart shopping_cart_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.shopping_cart
    ADD CONSTRAINT shopping_cart_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.program(program_id) ON DELETE CASCADE;


--
-- TOC entry 3600 (class 2606 OID 17176)
-- Name: shopping_cart shopping_cart_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.shopping_cart
    ADD CONSTRAINT shopping_cart_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource(resource_id) ON DELETE CASCADE;


--
-- TOC entry 3601 (class 2606 OID 17156)
-- Name: shopping_cart shopping_cart_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.shopping_cart
    ADD CONSTRAINT shopping_cart_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id) ON DELETE CASCADE;


--
-- TOC entry 3609 (class 2606 OID 17260)
-- Name: websocket_session websocket_session_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: itmdemo
--

ALTER TABLE ONLY public.websocket_session
    ADD CONSTRAINT websocket_session_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id) ON DELETE CASCADE;


-- Completed on 2025-06-03 23:20:30

--
-- PostgreSQL database dump complete
--

