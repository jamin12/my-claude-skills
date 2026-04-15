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
│           ├── service/     # OutPort 구현체
│           └── mapper/
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
| OutPort | application/{도메인}/port/outbound/ | 영속성 인터페이스 | `SaveAlertOutPort` |
| Driving Adapter | adapter/{도메인}/restIn/ | InPort 호출 | REST Controller |
| Driven Adapter | adapter/{도메인}/jpaOut/ | OutPort 구현 | JPA Repository |

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
