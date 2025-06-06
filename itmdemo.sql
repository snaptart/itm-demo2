--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Debian 16.9-1.pgdg120+1)
-- Dumped by pg_dump version 17.4

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

--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: audit_log_audit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_log_audit_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_log_audit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_log_audit_id_seq OWNED BY public.audit_log.audit_id;


--
-- Name: booking; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: booking_booking_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.booking_booking_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: booking_booking_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.booking_booking_id_seq OWNED BY public.booking.booking_id;


--
-- Name: episode; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: episode_episode_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.episode_episode_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: episode_episode_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.episode_episode_id_seq OWNED BY public.episode.episode_id;


--
-- Name: event; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: event_event_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.event_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: event_event_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.event_event_id_seq OWNED BY public.event.event_id;


--
-- Name: facility; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: facility_facility_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.facility_facility_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: facility_facility_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.facility_facility_id_seq OWNED BY public.facility.facility_id;


--
-- Name: facility_holiday; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: facility_holiday_holiday_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.facility_holiday_holiday_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: facility_holiday_holiday_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.facility_holiday_holiday_id_seq OWNED BY public.facility_holiday.holiday_id;


--
-- Name: facility_hours; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: facility_hours_hours_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.facility_hours_hours_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: facility_hours_hours_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.facility_hours_hours_id_seq OWNED BY public.facility_hours.hours_id;


--
-- Name: facility_maintenance; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: facility_maintenance_maintenance_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.facility_maintenance_maintenance_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: facility_maintenance_maintenance_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.facility_maintenance_maintenance_id_seq OWNED BY public.facility_maintenance.maintenance_id;


--
-- Name: facility_pricing; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: facility_pricing_pricing_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.facility_pricing_pricing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: facility_pricing_pricing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.facility_pricing_pricing_id_seq OWNED BY public.facility_pricing.pricing_id;


--
-- Name: ice_time_request; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: ice_time_request_request_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ice_time_request_request_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ice_time_request_request_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ice_time_request_request_id_seq OWNED BY public.ice_time_request.request_id;


--
-- Name: notification; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: notification_notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notification_notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notification_notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notification_notification_id_seq OWNED BY public.notification.notification_id;


--
-- Name: program; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: program_program_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.program_program_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: program_program_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.program_program_id_seq OWNED BY public.program.program_id;


--
-- Name: program_type; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: program_type_program_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.program_type_program_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: program_type_program_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.program_type_program_type_id_seq OWNED BY public.program_type.program_type_id;


--
-- Name: realtime_notification; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: realtime_notification_notification_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.realtime_notification_notification_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: realtime_notification_notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.realtime_notification_notification_id_seq OWNED BY public.realtime_notification.notification_id;


--
-- Name: recurrence_exception; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recurrence_exception (
    exception_id integer NOT NULL,
    event_id integer NOT NULL,
    exception_date date NOT NULL,
    reason character varying(255),
    created_by character varying(30),
    create_ts timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: recurrence_exception_exception_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recurrence_exception_exception_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recurrence_exception_exception_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recurrence_exception_exception_id_seq OWNED BY public.recurrence_exception.exception_id;


--
-- Name: recurrence_pattern; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: recurrence_pattern_pattern_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.recurrence_pattern_pattern_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: recurrence_pattern_pattern_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.recurrence_pattern_pattern_id_seq OWNED BY public.recurrence_pattern.pattern_id;


--
-- Name: request_status_history; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: request_status_history_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.request_status_history_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: request_status_history_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.request_status_history_history_id_seq OWNED BY public.request_status_history.history_id;


--
-- Name: resource; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: resource_resource_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.resource_resource_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: resource_resource_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.resource_resource_id_seq OWNED BY public.resource.resource_id;


--
-- Name: resource_type; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: resource_type_resource_type_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.resource_type_resource_type_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: resource_type_resource_type_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.resource_type_resource_type_id_seq OWNED BY public.resource_type.resource_type_id;


--
-- Name: shopping_cart; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: shopping_cart_cart_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shopping_cart_cart_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shopping_cart_cart_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shopping_cart_cart_id_seq OWNED BY public.shopping_cart.cart_id;


--
-- Name: user; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: user_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_user_id_seq OWNED BY public."user".user_id;


--
-- Name: v_audit_trail; Type: VIEW; Schema: public; Owner: -
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


--
-- Name: v_booking_requests; Type: VIEW; Schema: public; Owner: -
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


--
-- Name: v_episode_availability; Type: VIEW; Schema: public; Owner: -
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


--
-- Name: v_request_summary; Type: VIEW; Schema: public; Owner: -
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


--
-- Name: v_shopping_cart_details; Type: VIEW; Schema: public; Owner: -
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


--
-- Name: websocket_session; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: audit_log audit_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN audit_id SET DEFAULT nextval('public.audit_log_audit_id_seq'::regclass);


--
-- Name: booking booking_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking ALTER COLUMN booking_id SET DEFAULT nextval('public.booking_booking_id_seq'::regclass);


--
-- Name: episode episode_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode ALTER COLUMN episode_id SET DEFAULT nextval('public.episode_episode_id_seq'::regclass);


--
-- Name: event event_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event ALTER COLUMN event_id SET DEFAULT nextval('public.event_event_id_seq'::regclass);


--
-- Name: facility facility_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility ALTER COLUMN facility_id SET DEFAULT nextval('public.facility_facility_id_seq'::regclass);


--
-- Name: facility_holiday holiday_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_holiday ALTER COLUMN holiday_id SET DEFAULT nextval('public.facility_holiday_holiday_id_seq'::regclass);


--
-- Name: facility_hours hours_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_hours ALTER COLUMN hours_id SET DEFAULT nextval('public.facility_hours_hours_id_seq'::regclass);


--
-- Name: facility_maintenance maintenance_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_maintenance ALTER COLUMN maintenance_id SET DEFAULT nextval('public.facility_maintenance_maintenance_id_seq'::regclass);


--
-- Name: facility_pricing pricing_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_pricing ALTER COLUMN pricing_id SET DEFAULT nextval('public.facility_pricing_pricing_id_seq'::regclass);


--
-- Name: ice_time_request request_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ice_time_request ALTER COLUMN request_id SET DEFAULT nextval('public.ice_time_request_request_id_seq'::regclass);


--
-- Name: notification notification_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification ALTER COLUMN notification_id SET DEFAULT nextval('public.notification_notification_id_seq'::regclass);


--
-- Name: program program_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program ALTER COLUMN program_id SET DEFAULT nextval('public.program_program_id_seq'::regclass);


--
-- Name: program_type program_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_type ALTER COLUMN program_type_id SET DEFAULT nextval('public.program_type_program_type_id_seq'::regclass);


--
-- Name: realtime_notification notification_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realtime_notification ALTER COLUMN notification_id SET DEFAULT nextval('public.realtime_notification_notification_id_seq'::regclass);


--
-- Name: recurrence_exception exception_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurrence_exception ALTER COLUMN exception_id SET DEFAULT nextval('public.recurrence_exception_exception_id_seq'::regclass);


--
-- Name: recurrence_pattern pattern_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurrence_pattern ALTER COLUMN pattern_id SET DEFAULT nextval('public.recurrence_pattern_pattern_id_seq'::regclass);


--
-- Name: request_status_history history_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_status_history ALTER COLUMN history_id SET DEFAULT nextval('public.request_status_history_history_id_seq'::regclass);


--
-- Name: resource resource_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource ALTER COLUMN resource_id SET DEFAULT nextval('public.resource_resource_id_seq'::regclass);


--
-- Name: resource_type resource_type_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_type ALTER COLUMN resource_type_id SET DEFAULT nextval('public.resource_type_resource_type_id_seq'::regclass);


--
-- Name: shopping_cart cart_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_cart ALTER COLUMN cart_id SET DEFAULT nextval('public.shopping_cart_cart_id_seq'::regclass);


--
-- Name: user user_id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user" ALTER COLUMN user_id SET DEFAULT nextval('public.user_user_id_seq'::regclass);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (audit_id);


--
-- Name: booking booking_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking
    ADD CONSTRAINT booking_pkey PRIMARY KEY (booking_id);


--
-- Name: episode episode_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode
    ADD CONSTRAINT episode_pkey PRIMARY KEY (episode_id);


--
-- Name: event event_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event
    ADD CONSTRAINT event_pkey PRIMARY KEY (event_id);


--
-- Name: facility_holiday facility_holiday_facility_id_holiday_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_holiday
    ADD CONSTRAINT facility_holiday_facility_id_holiday_date_key UNIQUE (facility_id, holiday_date);


--
-- Name: facility_holiday facility_holiday_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_holiday
    ADD CONSTRAINT facility_holiday_pkey PRIMARY KEY (holiday_id);


--
-- Name: facility_hours facility_hours_facility_id_day_of_week_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_hours
    ADD CONSTRAINT facility_hours_facility_id_day_of_week_key UNIQUE (facility_id, day_of_week);


--
-- Name: facility_hours facility_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_hours
    ADD CONSTRAINT facility_hours_pkey PRIMARY KEY (hours_id);


--
-- Name: facility_maintenance facility_maintenance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_maintenance
    ADD CONSTRAINT facility_maintenance_pkey PRIMARY KEY (maintenance_id);


--
-- Name: facility facility_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility
    ADD CONSTRAINT facility_pkey PRIMARY KEY (facility_id);


--
-- Name: facility_pricing facility_pricing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_pricing
    ADD CONSTRAINT facility_pricing_pkey PRIMARY KEY (pricing_id);


--
-- Name: ice_time_request ice_time_request_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ice_time_request
    ADD CONSTRAINT ice_time_request_pkey PRIMARY KEY (request_id);


--
-- Name: ice_time_request ice_time_request_request_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ice_time_request
    ADD CONSTRAINT ice_time_request_request_number_key UNIQUE (request_number);


--
-- Name: notification notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT notification_pkey PRIMARY KEY (notification_id);


--
-- Name: program program_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program
    ADD CONSTRAINT program_pkey PRIMARY KEY (program_id);


--
-- Name: program_type program_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program_type
    ADD CONSTRAINT program_type_pkey PRIMARY KEY (program_type_id);


--
-- Name: realtime_notification realtime_notification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realtime_notification
    ADD CONSTRAINT realtime_notification_pkey PRIMARY KEY (notification_id);


--
-- Name: recurrence_exception recurrence_exception_event_id_exception_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurrence_exception
    ADD CONSTRAINT recurrence_exception_event_id_exception_date_key UNIQUE (event_id, exception_date);


--
-- Name: recurrence_exception recurrence_exception_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurrence_exception
    ADD CONSTRAINT recurrence_exception_pkey PRIMARY KEY (exception_id);


--
-- Name: recurrence_pattern recurrence_pattern_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurrence_pattern
    ADD CONSTRAINT recurrence_pattern_pkey PRIMARY KEY (pattern_id);


--
-- Name: request_status_history request_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_status_history
    ADD CONSTRAINT request_status_history_pkey PRIMARY KEY (history_id);


--
-- Name: resource resource_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource
    ADD CONSTRAINT resource_pkey PRIMARY KEY (resource_id);


--
-- Name: resource_type resource_type_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource_type
    ADD CONSTRAINT resource_type_pkey PRIMARY KEY (resource_type_id);


--
-- Name: shopping_cart shopping_cart_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_cart
    ADD CONSTRAINT shopping_cart_pkey PRIMARY KEY (cart_id);


--
-- Name: shopping_cart unique_user_episode_cart; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_cart
    ADD CONSTRAINT unique_user_episode_cart UNIQUE (user_id, episode_id);


--
-- Name: user user_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_email_key UNIQUE (email);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (user_id);


--
-- Name: user user_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_username_key UNIQUE (username);


--
-- Name: websocket_session websocket_session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.websocket_session
    ADD CONSTRAINT websocket_session_pkey PRIMARY KEY (session_id);


--
-- Name: idx_audit_log_table; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_table ON public.audit_log USING btree (table_name, record_id);


--
-- Name: idx_audit_log_timestamp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_timestamp ON public.audit_log USING btree ("timestamp");


--
-- Name: idx_audit_log_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_user ON public.audit_log USING btree (user_id);


--
-- Name: idx_booking_create_ts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_create_ts ON public.booking USING btree (create_ts);


--
-- Name: idx_booking_episode_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_episode_id ON public.booking USING btree (episode_id);


--
-- Name: idx_booking_episode_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_episode_status ON public.booking USING btree (episode_id, booking_status);


--
-- Name: idx_booking_program_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_program_id ON public.booking USING btree (program_id);


--
-- Name: idx_booking_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_status ON public.booking USING btree (booking_status);


--
-- Name: idx_booking_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_booking_user_id ON public.booking USING btree (user_id);


--
-- Name: idx_cart_added_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_added_at ON public.shopping_cart USING btree (added_at);


--
-- Name: idx_cart_episode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_episode ON public.shopping_cart USING btree (episode_id);


--
-- Name: idx_cart_facility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_facility ON public.shopping_cart USING btree (facility_id);


--
-- Name: idx_cart_user_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cart_user_program ON public.shopping_cart USING btree (user_id, program_id);


--
-- Name: idx_episode_assigned_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_assigned_program ON public.episode USING btree (assigned_to_program_id);


--
-- Name: idx_episode_end_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_end_date_time ON public.episode USING btree (episode_end_date_time);


--
-- Name: idx_episode_program_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_program_id ON public.episode USING btree (program_id);


--
-- Name: idx_episode_schedule_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_schedule_id ON public.episode USING btree (schedule_id);


--
-- Name: idx_episode_start_date_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_start_date_time ON public.episode USING btree (episode_start_date_time);


--
-- Name: idx_episode_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_status ON public.episode USING btree (episode_status);


--
-- Name: idx_episode_status_start_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_episode_status_start_time ON public.episode USING btree (episode_status, episode_start_date_time);


--
-- Name: idx_event_parent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_parent ON public.event USING btree (parent_event_id);


--
-- Name: idx_facility_holiday_facility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_facility_holiday_facility ON public.facility_holiday USING btree (facility_id);


--
-- Name: idx_facility_hours_facility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_facility_hours_facility ON public.facility_hours USING btree (facility_id);


--
-- Name: idx_facility_maintenance_facility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_facility_maintenance_facility ON public.facility_maintenance USING btree (facility_id);


--
-- Name: idx_facility_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_facility_org_id ON public.facility USING btree (org_id);


--
-- Name: idx_facility_pricing_facility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_facility_pricing_facility ON public.facility_pricing USING btree (facility_id);


--
-- Name: idx_notification_create_ts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_create_ts ON public.notification USING btree (create_ts);


--
-- Name: idx_notification_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_is_read ON public.notification USING btree (is_read);


--
-- Name: idx_notification_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_user_id ON public.notification USING btree (user_id);


--
-- Name: idx_program_scheduler; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_program_scheduler ON public.program USING btree (scheduler_user_id);


--
-- Name: idx_realtime_delivery; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_realtime_delivery ON public.realtime_notification USING btree (is_delivered, sent_at);


--
-- Name: idx_realtime_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_realtime_event ON public.realtime_notification USING btree (event_type);


--
-- Name: idx_realtime_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_realtime_expires ON public.realtime_notification USING btree (expires_at);


--
-- Name: idx_realtime_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_realtime_target ON public.realtime_notification USING btree (target_type, target_id);


--
-- Name: idx_recurrence_exception_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recurrence_exception_event ON public.recurrence_exception USING btree (event_id);


--
-- Name: idx_recurrence_pattern_event; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_recurrence_pattern_event ON public.recurrence_pattern USING btree (event_id);


--
-- Name: idx_request_episode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_episode ON public.ice_time_request USING btree (episode_id);


--
-- Name: idx_request_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_expires ON public.ice_time_request USING btree (expires_at);


--
-- Name: idx_request_facility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_facility ON public.ice_time_request USING btree (facility_id);


--
-- Name: idx_request_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_status ON public.ice_time_request USING btree (request_status);


--
-- Name: idx_request_submitted; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_submitted ON public.ice_time_request USING btree (submitted_at);


--
-- Name: idx_request_user_program; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_request_user_program ON public.ice_time_request USING btree (user_id, program_id);


--
-- Name: idx_status_history_changed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_status_history_changed ON public.request_status_history USING btree (changed_at);


--
-- Name: idx_status_history_request; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_status_history_request ON public.request_status_history USING btree (request_id);


--
-- Name: idx_user_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_email ON public."user" USING btree (email);


--
-- Name: idx_user_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_type ON public."user" USING btree (user_type);


--
-- Name: idx_user_type_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_type_active ON public."user" USING btree (user_type, is_active);


--
-- Name: idx_user_username; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_username ON public."user" USING btree (username);


--
-- Name: idx_websocket_activity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_websocket_activity ON public.websocket_session USING btree (last_activity);


--
-- Name: idx_websocket_facilities; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_websocket_facilities ON public.websocket_session USING gin (facility_ids);


--
-- Name: idx_websocket_programs; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_websocket_programs ON public.websocket_session USING gin (program_ids);


--
-- Name: idx_websocket_socket; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_websocket_socket ON public.websocket_session USING btree (socket_id);


--
-- Name: idx_websocket_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_websocket_user ON public.websocket_session USING btree (user_id);


--
-- Name: booking trg_audit_booking; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_booking AFTER INSERT OR DELETE OR UPDATE ON public.booking FOR EACH ROW EXECUTE FUNCTION public.fn_create_audit_log();


--
-- Name: episode trg_audit_episode; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_episode AFTER INSERT OR DELETE OR UPDATE ON public.episode FOR EACH ROW EXECUTE FUNCTION public.fn_create_audit_log();


--
-- Name: event trg_audit_event; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_event AFTER INSERT OR DELETE OR UPDATE ON public.event FOR EACH ROW EXECUTE FUNCTION public.fn_create_audit_log();


--
-- Name: booking trg_booking_update_ts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_booking_update_ts BEFORE UPDATE ON public.booking FOR EACH ROW EXECUTE FUNCTION public.fn_update_booking_timestamp();


--
-- Name: episode trg_episode_update_ts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_episode_update_ts BEFORE UPDATE ON public.episode FOR EACH ROW EXECUTE FUNCTION public.fn_update_episode_timestamp();


--
-- Name: event trg_event_update_ts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_event_update_ts BEFORE UPDATE ON public.event FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp_event();


--
-- Name: facility trg_facility_update_ts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_facility_update_ts BEFORE UPDATE ON public.facility FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();


--
-- Name: ice_time_request trg_log_request_status_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_log_request_status_change AFTER UPDATE ON public.ice_time_request FOR EACH ROW EXECUTE FUNCTION public.log_request_status_change();


--
-- Name: program_type trg_program_type_update_ts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_program_type_update_ts BEFORE UPDATE ON public.program_type FOR EACH ROW EXECUTE FUNCTION public.fn_update_program_type_timestamp();


--
-- Name: program trg_program_update_ts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_program_update_ts BEFORE UPDATE ON public.program FOR EACH ROW EXECUTE FUNCTION public.fn_update_program_timestamp();


--
-- Name: recurrence_pattern trg_recurrence_pattern_update_ts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_recurrence_pattern_update_ts BEFORE UPDATE ON public.recurrence_pattern FOR EACH ROW EXECUTE FUNCTION public.fn_update_recurrence_pattern_timestamp();


--
-- Name: ice_time_request trg_request_update_ts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_request_update_ts BEFORE UPDATE ON public.ice_time_request FOR EACH ROW EXECUTE FUNCTION public.update_request_timestamp();


--
-- Name: resource_type trg_resource_type_update_ts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_resource_type_update_ts BEFORE UPDATE ON public.resource_type FOR EACH ROW EXECUTE FUNCTION public.fn_update_resource_type_timestamp();


--
-- Name: resource trg_resource_update_ts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_resource_update_ts BEFORE UPDATE ON public.resource FOR EACH ROW EXECUTE FUNCTION public.fn_update_resource_timestamp();


--
-- Name: ice_time_request trg_set_request_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_request_number BEFORE INSERT ON public.ice_time_request FOR EACH ROW EXECUTE FUNCTION public.set_request_number();


--
-- Name: user trg_user_update_ts; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_user_update_ts BEFORE UPDATE ON public."user" FOR EACH ROW EXECUTE FUNCTION public.fn_update_user_timestamp();


--
-- Name: event trg_validate_facility_hours; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_validate_facility_hours BEFORE INSERT OR UPDATE ON public.event FOR EACH ROW EXECUTE FUNCTION public.fn_validate_facility_hours();


--
-- Name: episode event_ibfk1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode
    ADD CONSTRAINT event_ibfk1 FOREIGN KEY (event_id) REFERENCES public.event(event_id);


--
-- Name: event event_parent_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event
    ADD CONSTRAINT event_parent_event_id_fkey FOREIGN KEY (parent_event_id) REFERENCES public.event(event_id);


--
-- Name: event event_recurrence_pattern_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event
    ADD CONSTRAINT event_recurrence_pattern_id_fkey FOREIGN KEY (recurrence_pattern_id) REFERENCES public.recurrence_pattern(pattern_id);


--
-- Name: facility_holiday facility_holiday_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_holiday
    ADD CONSTRAINT facility_holiday_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(facility_id) ON DELETE CASCADE;


--
-- Name: facility_hours facility_hours_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_hours
    ADD CONSTRAINT facility_hours_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(facility_id) ON DELETE CASCADE;


--
-- Name: resource facility_id_ibfk1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource
    ADD CONSTRAINT facility_id_ibfk1 FOREIGN KEY (facility_id) REFERENCES public.facility(facility_id);


--
-- Name: facility_maintenance facility_maintenance_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_maintenance
    ADD CONSTRAINT facility_maintenance_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(facility_id) ON DELETE CASCADE;


--
-- Name: facility_maintenance facility_maintenance_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_maintenance
    ADD CONSTRAINT facility_maintenance_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource(resource_id);


--
-- Name: facility_pricing facility_pricing_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_pricing
    ADD CONSTRAINT facility_pricing_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(facility_id) ON DELETE CASCADE;


--
-- Name: facility_pricing facility_pricing_program_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_pricing
    ADD CONSTRAINT facility_pricing_program_type_id_fkey FOREIGN KEY (program_type_id) REFERENCES public.program_type(program_type_id);


--
-- Name: facility_pricing facility_pricing_resource_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility_pricing
    ADD CONSTRAINT facility_pricing_resource_type_id_fkey FOREIGN KEY (resource_type_id) REFERENCES public.resource_type(resource_type_id);


--
-- Name: booking fk_booking_approved_by; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking
    ADD CONSTRAINT fk_booking_approved_by FOREIGN KEY (approved_by_user_id) REFERENCES public."user"(user_id);


--
-- Name: booking fk_booking_episode; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking
    ADD CONSTRAINT fk_booking_episode FOREIGN KEY (episode_id) REFERENCES public.episode(episode_id);


--
-- Name: booking fk_booking_program; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking
    ADD CONSTRAINT fk_booking_program FOREIGN KEY (program_id) REFERENCES public.program(program_id);


--
-- Name: booking fk_booking_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking
    ADD CONSTRAINT fk_booking_user FOREIGN KEY (user_id) REFERENCES public."user"(user_id);


--
-- Name: episode fk_episode_assigned_program; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episode
    ADD CONSTRAINT fk_episode_assigned_program FOREIGN KEY (assigned_to_program_id) REFERENCES public.program(program_id);


--
-- Name: facility fk_facility_admin_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.facility
    ADD CONSTRAINT fk_facility_admin_user FOREIGN KEY (admin_user_id) REFERENCES public."user"(user_id);


--
-- Name: notification fk_notification_booking; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT fk_notification_booking FOREIGN KEY (related_booking_id) REFERENCES public.booking(booking_id);


--
-- Name: notification fk_notification_episode; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT fk_notification_episode FOREIGN KEY (related_episode_id) REFERENCES public.episode(episode_id);


--
-- Name: notification fk_notification_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification
    ADD CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES public."user"(user_id);


--
-- Name: program fk_program_scheduler_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program
    ADD CONSTRAINT fk_program_scheduler_user FOREIGN KEY (scheduler_user_id) REFERENCES public."user"(user_id);


--
-- Name: resource fk_resource_type; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resource
    ADD CONSTRAINT fk_resource_type FOREIGN KEY (resource_type_id) REFERENCES public.resource_type(resource_type_id);


--
-- Name: ice_time_request ice_time_request_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ice_time_request
    ADD CONSTRAINT ice_time_request_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episode(episode_id);


--
-- Name: ice_time_request ice_time_request_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ice_time_request
    ADD CONSTRAINT ice_time_request_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(facility_id);


--
-- Name: ice_time_request ice_time_request_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ice_time_request
    ADD CONSTRAINT ice_time_request_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.program(program_id);


--
-- Name: ice_time_request ice_time_request_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ice_time_request
    ADD CONSTRAINT ice_time_request_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource(resource_id);


--
-- Name: ice_time_request ice_time_request_reviewed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ice_time_request
    ADD CONSTRAINT ice_time_request_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES public."user"(user_id);


--
-- Name: ice_time_request ice_time_request_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ice_time_request
    ADD CONSTRAINT ice_time_request_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id);


--
-- Name: program program_type_ibfk1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.program
    ADD CONSTRAINT program_type_ibfk1 FOREIGN KEY (program_type_id) REFERENCES public.program_type(program_type_id);


--
-- Name: realtime_notification realtime_notification_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.realtime_notification
    ADD CONSTRAINT realtime_notification_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public."user"(user_id);


--
-- Name: recurrence_exception recurrence_exception_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurrence_exception
    ADD CONSTRAINT recurrence_exception_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(event_id) ON DELETE CASCADE;


--
-- Name: recurrence_pattern recurrence_pattern_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recurrence_pattern
    ADD CONSTRAINT recurrence_pattern_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.event(event_id) ON DELETE CASCADE;


--
-- Name: request_status_history request_status_history_changed_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_status_history
    ADD CONSTRAINT request_status_history_changed_by_user_id_fkey FOREIGN KEY (changed_by_user_id) REFERENCES public."user"(user_id);


--
-- Name: request_status_history request_status_history_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_status_history
    ADD CONSTRAINT request_status_history_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.ice_time_request(request_id) ON DELETE CASCADE;


--
-- Name: event resource_ibfk1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event
    ADD CONSTRAINT resource_ibfk1 FOREIGN KEY (resource_id) REFERENCES public.resource(resource_id);


--
-- Name: shopping_cart shopping_cart_episode_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_cart
    ADD CONSTRAINT shopping_cart_episode_id_fkey FOREIGN KEY (episode_id) REFERENCES public.episode(episode_id) ON DELETE CASCADE;


--
-- Name: shopping_cart shopping_cart_facility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_cart
    ADD CONSTRAINT shopping_cart_facility_id_fkey FOREIGN KEY (facility_id) REFERENCES public.facility(facility_id) ON DELETE CASCADE;


--
-- Name: shopping_cart shopping_cart_program_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_cart
    ADD CONSTRAINT shopping_cart_program_id_fkey FOREIGN KEY (program_id) REFERENCES public.program(program_id) ON DELETE CASCADE;


--
-- Name: shopping_cart shopping_cart_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_cart
    ADD CONSTRAINT shopping_cart_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.resource(resource_id) ON DELETE CASCADE;


--
-- Name: shopping_cart shopping_cart_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shopping_cart
    ADD CONSTRAINT shopping_cart_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id) ON DELETE CASCADE;


--
-- Name: websocket_session websocket_session_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.websocket_session
    ADD CONSTRAINT websocket_session_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."user"(user_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

