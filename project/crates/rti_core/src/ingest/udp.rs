use std::net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket};
use std::time::Duration;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UdpMode {
    Unicast,
    Multicast,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UdpReceiverConfig {
    pub mode: UdpMode,
    pub bind_ip: IpAddr,
    pub bind_port: u16,
    pub source_ip: Option<IpAddr>,
    pub multicast_group: Option<IpAddr>,
    pub expected_bitrate_mbps: u32,
}

impl UdpReceiverConfig {
    pub fn validate(&self) -> Result<(), String> {
        if self.bind_port == 0 {
            return Err("bind_port must be non-zero".to_string());
        }
        if !(1..=30).contains(&self.expected_bitrate_mbps) {
            return Err("expected_bitrate_mbps must be within 1..=30".to_string());
        }
        match self.mode {
            UdpMode::Unicast => {
                if self.multicast_group.is_some() {
                    return Err("unicast mode must not set multicast_group".to_string());
                }
            }
            UdpMode::Multicast => {
                let group = self
                    .multicast_group
                    .ok_or_else(|| "multicast mode requires multicast_group".to_string())?;
                if !is_multicast(group) {
                    return Err("multicast_group must be a multicast address".to_string());
                }
            }
        }
        Ok(())
    }

    pub fn bind_addr(&self) -> Result<SocketAddr, String> {
        self.validate()?;
        Ok(SocketAddr::new(self.bind_ip, self.bind_port))
    }
}

pub fn default_pcm_udp_config() -> UdpReceiverConfig {
    UdpReceiverConfig {
        mode: UdpMode::Multicast,
        bind_ip: IpAddr::V4(Ipv4Addr::UNSPECIFIED),
        bind_port: 5001,
        source_ip: None,
        multicast_group: Some(IpAddr::V4(Ipv4Addr::new(239, 192, 1, 10))),
        expected_bitrate_mbps: 30,
    }
}

pub fn bind_receiver(config: &UdpReceiverConfig) -> Result<UdpSocket, String> {
    let socket = UdpSocket::bind(config.bind_addr()?).map_err(|err| err.to_string())?;
    socket
        .set_nonblocking(false)
        .map_err(|err| format!("failed to configure blocking UDP socket: {err}"))?;
    if let (UdpMode::Multicast, Some(IpAddr::V4(group)), IpAddr::V4(interface)) =
        (&config.mode, config.multicast_group, config.bind_ip)
    {
        let iface = if interface.is_unspecified() {
            Ipv4Addr::UNSPECIFIED
        } else {
            interface
        };
        socket
            .join_multicast_v4(&group, &iface)
            .map_err(|err| format!("failed to join multicast group {group}: {err}"))?;
    }
    Ok(socket)
}

pub fn receive_datagram(
    socket: &UdpSocket,
    max_len: usize,
    timeout: Duration,
) -> Result<Vec<u8>, String> {
    if max_len == 0 {
        return Err("max_len must be non-zero".to_string());
    }
    socket
        .set_read_timeout(Some(timeout))
        .map_err(|err| format!("failed to set UDP read timeout: {err}"))?;
    let mut buffer = vec![0u8; max_len];
    let (len, _) = socket.recv_from(&mut buffer).map_err(|err| err.to_string())?;
    buffer.truncate(len);
    Ok(buffer)
}

fn is_multicast(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(addr) => addr.is_multicast(),
        IpAddr::V6(addr) => addr.is_multicast(),
    }
}
