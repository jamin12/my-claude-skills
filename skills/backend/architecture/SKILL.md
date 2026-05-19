---
name: architecture
description: 헥사고날 아키텍처(Ports & Adapters) 레이어 구조와 의존성 방향 규칙. 새 기능 추가, 리팩토링, 아키텍처 관련 작업 시 참조한다.
---

# 헥사고날 아키텍처 & 의존성 방향 규칙

## 레이어 구조

```
src/main/kotlin/{basePackagePath}/
├── config/
├── adapter/
│   └── {도메인}/
│       ├── restIn/          # Driving Adapter (REST Controller)
│       │   ├── controller/
│       │   ├── dto/
│       │   └── mapper/
│       └── jpaOut/          # Driven Adapter (JPA)
│           ├── entity/
│           ├── repository/
│           ├── mapper/
│           └── *JpaAdapter.kt  # OutPort 구현체 (jpaOut/ 바로 밑, service/ 같은 폴더 X)
├── application/
│   └── {도메인}/
│       ├── service/         # UseCase 구현
│       ├── port/
│       │   ├── inbound/    # InPort (UseCase 인터페이스)
│       │   └── outbound/   # OutPort (영속성 인터페이스)
│       ├── dto/
│       ├── mapper/
│       └── exception/
└── domain/
    └── {도메인}/
        ├── CLAUDE.md        # 도메인 상세 명세
        ├── model/
        ├── vo/
        ├── enums/
        └── event/
```

## 4가지 포트 역할

| 포트 | 위치 | 역할 | 예시 |
|------|------|------|------|
| InPort | application/{도메인}/port/inbound/ | UseCase 인터페이스 | `CreateAlertInPort` |
| OutPort | application/{도메인}/port/outbound/ | 외부 의존 인터페이스 | `AlertOutPort` |
| Driving Adapter | adapter/{도메인}/restIn/ | InPort 호출 | REST Controller |
| Driven Adapter | adapter/{도메인}/{외부의존}Out/ | OutPort 구현 | JPA/HTTP/JWT Adapter |

### Driven Adapter 위치 규칙
외부 의존 종류별로 `{외부의존}Out/` 폴더를 만들고, **OutPort 구현체는 그 폴더 바로 밑**에 둔다.
`service/` 같은 하위 폴더를 만들지 않는다 — 어댑터는 비즈니스 서비스가 아니라 외부 의존 어댑터이고,
`{외부의존}Out/` 자체가 이미 그 책임을 가리키기 때문이다.

```
adapter/auth/
├── jwtOut/JwtJjwtAdapter.kt         # JJWT 어댑터
├── googleOut/GoogleJwksAdapter.kt   # Google JWKS 어댑터
adapter/member/
└── jpaOut/MemberJpaAdapter.kt       # JPA 어댑터 (jpaOut/ 바로 밑)
```

어댑터 빈은 `@Component` 로 등록한다 (`@Service` 는 application 서비스용).

## OutPort 분리 기준

**한 외부 의존 = 한 OutPort.** 외부 의존 단위로 OutPort를 묶는다.

| 외부 의존 종류 | 묶음 단위 | OutPort 네이밍 |
|--------------|----------|---------------|
| RDB | 테이블(또는 aggregate root) 1개 | `{도메인}OutPort` |
| 외부 HTTP API | 외부 시스템 1개 | `{시스템명}OutPort` |
| 라이브러리/SDK | 라이브러리(또는 기능) 1개 | `{라이브러리/기능명}OutPort` |
| 메시지 브로커 | 토픽/큐 1개 | `{토픽명}OutPort` |
| 캐시/검색 | 논리 인스턴스 1개 | `{기능명}OutPort` |

그 외부 의존에 대해 UseCase들이 필요로 하는 **모든 행위**가 한 OutPort에 모인다.

```kotlin
// 한 테이블에 대한 모든 행위가 한 OutPort에 모인다
interface AlertOutPort {
    fun save(alert: Alert): Alert
    fun findById(id: AlertId): Alert?
    fun findByOwner(ownerId: OwnerId): List<Alert>
    fun deleteById(id: AlertId)
}
```

### 행위 단위로 쪼개지 않는 이유

- **자동 결정**: 새 메서드를 추가할 때 "어느 OutPort에 넣을까" 케이스 판단이 불필요. 외부 의존이 같으면 그 OutPort에 추가하면 된다.
- **어댑터-OutPort 1:1**: 한 어댑터 클래스가 그 외부 의존 전체를 책임진다. 자연히 OutPort 구현체도 1:1로 매핑된다.
- **OutPort 갯수 통제**: 행위마다 인터페이스를 만들면 수가 폭발한다.

ISP(Interface Segregation)를 더 엄격히 적용하려면 행위 단위로도 가능하지만, 본 컨벤션은 외부 의존 단위로 통일한다.

### OutPort를 분리하는 경우

같은 종류의 외부 의존이라도 다음에 해당하면 OutPort를 분리한다.

- **다른 테이블/aggregate**: 한 OutPort에는 한 테이블/aggregate root에 대한 작업만 모은다. 다른 테이블이면 새 OutPort.
- **트랜잭션/연결 풀 경계가 다름**: 읽기 전용 슬레이브 vs 마스터, 어드민 DDL 전용 연결 등.
- **같은 클라이언트지만 의미가 완전히 다른 외부 시스템**: 동일 HTTP 라이브러리로 두 외부 시스템을 호출 → 두 OutPort.

## 새 기능 추가 시 생성 순서

1. Domain Model (`domain/{도메인}/model/`)
2. InPort 인터페이스 (`application/{도메인}/port/inbound/`)
3. OutPort 인터페이스 (`application/{도메인}/port/outbound/`)
4. UseCase 구현 (`application/{도메인}/service/`)
5. JPA Entity + Driven Adapter (`adapter/{도메인}/jpaOut/`)
6. REST Controller + Driving Adapter (`adapter/{도메인}/restIn/`)

## 의존성 방향

```
adapter → application → domain (단방향만 허용)
```

- **domain**: 외부 의존성 없음. 순수 비즈니스 로직만 포함. Spring 어노테이션 금지.
- **application**: domain에만 의존. 포트 인터페이스를 통해 외부와 소통. adapter 패키지 import 금지.
- **adapter**: application의 포트를 구현하거나 호출.

### 역방향 의존성 절대 금지

// WRONG - domain이 application을 의존
```kotlin
// domain/alert/model/Alert.kt
import {basePackage}.application.alert.dto.CreateAlertCommand  // 금지!
```

// WRONG - application이 adapter를 의존
```kotlin
// application/alert/service/CreateAlertUseCase.kt
import {basePackage}.adapter.alert.jpaOut.repository.AlertJpaRepository  // 금지!
```

// CORRECT - application은 OutPort 인터페이스만 의존
```kotlin
// application/alert/service/CreateAlertUseCase.kt
import {basePackage}.application.alert.port.outbound.SaveAlertOutPort  // OK
```

### domain에 금지되는 것들
- Spring 어노테이션 (`@Component`, `@Service`, `@Entity` 등)
- JPA 어노테이션 (`@Id`, `@Column`, `@Table` 등)
- 외부 라이브러리 import (Jackson, etc.)
- application/adapter 패키지 import

## 체크리스트
- [ ] 새 파일이 올바른 레이어(adapter/application/domain)에 위치하는가?
- [ ] 도메인별 패키지 안에 있는가?
- [ ] InPort/OutPort 인터페이스가 application 레이어에 있는가?
- [ ] Adapter가 adapter 레이어에 있는가?
- [ ] domain 패키지에 Spring/JPA 어노테이션이 없는가?
- [ ] application에서 adapter 패키지를 import하지 않는가?
- [ ] 의존성 방향이 adapter → application → domain 인가?
