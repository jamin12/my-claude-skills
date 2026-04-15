---
name: mapper
description: 매퍼 규칙(MapStruct vs 확장함수, REST/JPA/Application 매퍼 패턴). 매퍼 파일 작성/수정, 도메인-엔티티-DTO 변환 작업 시 참조한다.
---

# 매퍼 규칙

## 두 가지 매퍼 패턴

| 변환 대상 | 패턴 | 이유 |
|-----------|------|------|
| 도메인 모델 관련 (Entity↔Domain, Domain→Result) | **파일 레벨 확장함수** | Domain은 private constructor이므로 create()/restore() 호출 필요 |
| Request→Command | **MapStruct 인터페이스** | 필드명이 동일한 단순 변환에 적합 |
| Result→Response (단순 1:1 매핑) | **MapStruct 인터페이스** | 필드명이 동일한 단순 변환에 적합 |
| Result→Response (필드 조합/가공 필요) | **파일 레벨 확장함수** | 중첩 객체 구성, 타입 변환 등 MapStruct로 표현 어려운 경우 |

## JPA 매퍼 — 확장함수 패턴

위치: `adapter/{도메인}/jpaOut/mapper/`

```kotlin
// Entity → Domain (restore 호출)
fun CompanyJpaEntity.toDomain(): Company =
    Company.restore(id = this.id!!, name = this.name)

// Domain → Entity
fun Company.toEntity(): CompanyJpaEntity =
    CompanyJpaEntity(id = this.id, name = this.name)
```

// WRONG - object 싱글톤 매퍼
```kotlin
object AlertMapper {
    fun toEntity(domain: Alert): AlertEntity = ...
    fun toDomain(entity: AlertEntity): Alert = ...
}
```

## REST 매퍼 — MapStruct + 확장함수 공존

위치: `adapter/{도메인}/restIn/mapper/`

하나의 매퍼 파일에 두 패턴이 공존한다:

```kotlin
// MapStruct (data class → data class: Request → Command, Result → Response)
@Mapper(componentModel = "spring")
interface CompanyRestMapper {
    fun toCommand(request: CompanyRequest): UpsertCompanyCommand
    fun toResponse(result: CompanyResult): CompanyResponse
}
```

다중 파라미터 매핑 시 `@Mapping`으로 소스를 명시:

```kotlin
@Mapper(componentModel = "spring")
interface DepartmentRestMapper {
    @Mapping(source = "id", target = "id")
    fun toUpdateCommand(id: Long, request: UpdateDepartmentRequest): UpdateDepartmentCommand
}
```

## Application 매퍼 — Domain → Result 확장함수

위치: `application/{도메인}/mapper/`

```kotlin
fun GrmClose.toResult(): GrmCloseResult =
    GrmCloseResult(id = this.id!!, year = this.year)
```

## 매퍼 위치 요약

| 매퍼 종류 | 위치 | 패턴 |
|-----------|------|------|
| Entity ↔ Domain | `adapter/{도메인}/jpaOut/mapper/` | 확장함수 |
| Request → Command | `adapter/{도메인}/restIn/mapper/` | MapStruct |
| Result → Response (단순 1:1) | `adapter/{도메인}/restIn/mapper/` | MapStruct |
| Result → Response (필드 조합/가공) | `adapter/{도메인}/restIn/mapper/` | 확장함수 |
| Domain → Result | `application/{도메인}/mapper/` | 확장함수 |

## 체크리스트
- [ ] 도메인 모델 관련 매핑에 확장함수를 사용하는가?
- [ ] data class 간 변환에 MapStruct를 사용하는가?
- [ ] object 싱글톤 매퍼를 사용하지 않는가?
- [ ] 매퍼가 올바른 패키지에 위치하는가?
- [ ] REST 매퍼 파일에 MapStruct와 확장함수가 공존하는가?
